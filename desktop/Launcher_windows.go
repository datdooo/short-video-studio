// Single-file Windows x64 launcher. No installer, administrator rights or Go runtime required.
package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

//go:embed payload.zip
var payload []byte

var kernel = syscall.NewLazyDLL("kernel32.dll")
var user = syscall.NewLazyDLL("user32.dll")
var shell = syscall.NewLazyDLL("shell32.dll")

func ptr(s string) uintptr { p, _ := syscall.UTF16PtrFromString(s); return uintptr(unsafe.Pointer(p)) }
func message(text string, flags uintptr) uintptr {
	r, _, _ := user.NewProc("MessageBoxW").Call(0, ptr(text), ptr("ShortCut Studio"), flags)
	return r
}
func browser() {
	shell.NewProc("ShellExecuteW").Call(0, ptr("open"), ptr("http://127.0.0.1:5173/"), 0, 0, 1)
}

func unpack(root string) (string, error) {
	hash := sha256.Sum256(payload)
	target := filepath.Join(root, "runtime", hex.EncodeToString(hash[:12]))
	if _, err := os.Stat(filepath.Join(target, ".complete")); err == nil {
		return target, nil
	}
	if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return "", err
	}
	stage, err := os.MkdirTemp(filepath.Dir(target), ".extract-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(stage) // Only the fresh extraction directory, never media/runtime roots.
	z, err := zip.NewReader(bytes.NewReader(payload), int64(len(payload)))
	if err != nil {
		return "", err
	}
	for _, entry := range z.File {
		name := filepath.FromSlash(entry.Name)
		if !filepath.IsLocal(name) || strings.Contains(name, ":") || entry.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("invalid archive entry")
		}
		filename := filepath.Join(stage, name)
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(filename, 0700); err != nil {
				return "", err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
			return "", err
		}
		src, err := entry.Open()
		if err != nil {
			return "", err
		}
		dst, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			src.Close()
			return "", err
		}
		_, copyErr := io.Copy(dst, src)
		closeErr := dst.Close()
		src.Close()
		if copyErr != nil {
			return "", copyErr
		}
		if closeErr != nil {
			return "", closeErr
		}
	}
	if err := os.WriteFile(filepath.Join(stage, ".complete"), []byte("ok"), 0600); err != nil {
		return "", err
	}
	if err := os.Rename(stage, target); err != nil {
		return "", err
	}
	return target, nil
}

// Win32 JOBOBJECT_EXTENDED_LIMIT_INFORMATION, x64 layout (144 bytes).
type jobLimits struct {
	ProcessTime, JobTime                                       int64
	Flags                                                      uint32
	Padding                                                    uint32
	MinWorkingSet, MaxWorkingSet                               uintptr
	ActiveProcessLimit                                         uint32
	Padding2                                                   uint32
	Affinity                                                   uintptr
	PriorityClass, SchedulingClass                             uint32
	IO                                                         [6]uint64
	ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory uintptr
}

func launch(resources string, log *os.File) (syscall.Handle, syscall.Handle, error) {
	job, _, err := kernel.NewProc("CreateJobObjectW").Call(0, 0)
	if job == 0 {
		return 0, 0, err
	}
	limits := jobLimits{Flags: 0x2000} // KILL_ON_JOB_CLOSE; descendants inherit membership.
	ok, _, err := kernel.NewProc("SetInformationJobObject").Call(job, 9, uintptr(unsafe.Pointer(&limits)), unsafe.Sizeof(limits))
	if ok == 0 {
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	node := filepath.Join(resources, "runtime", "bin", "node.exe")
	command, _ := syscall.UTF16PtrFromString(syscall.EscapeArg(node) + " " + syscall.EscapeArg(filepath.Join(resources, "desktop", "windows-bootstrap.mjs")))
	dir, _ := syscall.UTF16PtrFromString(resources)
	// A suspended start closes the race between spawn and Job Object assignment.
	sa := syscall.SecurityAttributes{Length: uint32(unsafe.Sizeof(syscall.SecurityAttributes{})), InheritHandle: 1}
	var writeHandle syscall.Handle
	current, _ := syscall.GetCurrentProcess()
	err = syscall.DuplicateHandle(current, syscall.Handle(log.Fd()), current, &writeHandle, 0, true, 2)
	if err != nil {
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	defer syscall.CloseHandle(writeHandle)
	input, err := os.Open(os.DevNull)
	if err != nil {
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	defer input.Close()
	var readHandle syscall.Handle
	err = syscall.DuplicateHandle(current, syscall.Handle(input.Fd()), current, &readHandle, 0, true, 2)
	if err != nil {
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	defer syscall.CloseHandle(readHandle)
	si := syscall.StartupInfo{Cb: uint32(unsafe.Sizeof(syscall.StartupInfo{})), Flags: 0x100, StdInput: readHandle, StdOutput: writeHandle, StdErr: writeHandle}
	var pi syscall.ProcessInformation
	err = syscall.CreateProcess(nil, command, &sa, &sa, true, 0x08000004, nil, dir, &si, &pi)
	if err != nil {
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	defer syscall.CloseHandle(pi.Thread)
	ok, _, err = kernel.NewProc("AssignProcessToJobObject").Call(job, uintptr(pi.Process))
	if ok == 0 {
		syscall.TerminateProcess(pi.Process, 1)
		syscall.CloseHandle(pi.Process)
		syscall.CloseHandle(syscall.Handle(job))
		return 0, 0, err
	}
	if value, _, err := kernel.NewProc("ResumeThread").Call(uintptr(pi.Thread)); value == 0xffffffff {
		syscall.CloseHandle(syscall.Handle(job))
		syscall.CloseHandle(pi.Process)
		return 0, 0, err
	}
	return syscall.Handle(job), pi.Process, nil
}

func main() {
	if err := run(); err != nil {
		message(err.Error(), 0x10)
	}
}
func run() error {
	mutex, _, callErr := kernel.NewProc("CreateMutexW").Call(0, 0, ptr("Local\\ShortCutStudio.Windows.SingleInstance"))
	if mutex == 0 {
		return callErr
	}
	defer syscall.CloseHandle(syscall.Handle(mutex))
	if callErr == syscall.Errno(183) {
		browser()
		return nil
	}
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return fmt.Errorf("LOCALAPPDATA is missing")
	}
	root := filepath.Join(local, "ShortCut Studio")
	fmt.Println("ShortCut Studio — starting. First launch extracts the bundled runtime; please wait.")
	resources, err := unpack(root)
	if err != nil {
		return err
	}
	logRoot := filepath.Join(root, "logs")
	if err := os.MkdirAll(logRoot, 0700); err != nil {
		return err
	}
	logName := filepath.Join(logRoot, "startup.log")
	log, err := os.OpenFile(logName, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer log.Close()
	job, child, err := launch(resources, log)
	if err != nil {
		return err
	}
	defer syscall.CloseHandle(job)
	defer syscall.CloseHandle(child)
	done := make(chan error, 1)
	go func() {
		syscall.WaitForSingleObject(child, syscall.INFINITE)
		var code uint32
		syscall.GetExitCodeProcess(child, &code)
		done <- fmt.Errorf("ShortCut Studio stopped (%d). Log: %s", code, logName)
	}()
	go func() {
		reader := bufio.NewReader(os.Stdin)
		for {
			if _, err := reader.ReadString('\n'); err != nil {
				return
			}
			if message("Stop ShortCut Studio? Active downloads and renders will be cancelled.", 0x24) == 6 {
				done <- nil
				return
			}
		}
	}()
	fmt.Println("Keep this window open. The browser opens when ready. Press Enter to stop the app.")
	// The bootstrap writes a readiness marker only after both local services pass health checks.
	go func() {
		file, err := os.Open(logName)
		if err != nil {
			return
		}
		defer file.Close()
		var offset int64
		var pending string
		for {
			buffer := make([]byte, 8192)
			n, _ := file.ReadAt(buffer, offset)
			offset += int64(n)
			pending += string(buffer[:n])
			if strings.Contains(pending, "SHORTCUT_READY") {
				browser()
				fmt.Println("Ready: http://127.0.0.1:5173/")
				return
			}
			if len(pending) > 128 {
				pending = pending[len(pending)-128:]
			}
			time.Sleep(500 * time.Millisecond)
		}
	}()
	return <-done
}
