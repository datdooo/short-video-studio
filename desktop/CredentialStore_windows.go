// Native DPAPI storage for this app's OAuth credentials. No external dependencies.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

type dataBlob struct {
	Size uint32
	Data *byte
}

var crypt = syscall.NewLazyDLL("crypt32.dll")
var kernel = syscall.NewLazyDLL("kernel32.dll")
var magic = []byte("ShortCutStudio.DPAPI.v1\n")

func protect(data []byte, decrypt bool) ([]byte, error) {
	if len(data) == 0 || len(data) > 2*1024*1024 {
		return nil, errors.New("invalid credential size")
	}
	entropy := []byte("ShortCutStudio.ChatGPT.v1")
	in, extra := dataBlob{uint32(len(data)), &data[0]}, dataBlob{uint32(len(entropy)), &entropy[0]}
	var out dataBlob
	name := "CryptProtectData"
	if decrypt {
		name = "CryptUnprotectData"
	}
	// CurrentUser only: never CRYPTPROTECT_LOCAL_MACHINE. Disable OS UI prompts.
	ok, _, _ := crypt.NewProc(name).Call(uintptr(unsafe.Pointer(&in)), 0, uintptr(unsafe.Pointer(&extra)), 0, 0, 1, uintptr(unsafe.Pointer(&out)))
	runtime.KeepAlive(data)
	runtime.KeepAlive(entropy)
	if ok == 0 {
		return nil, errors.New("Windows DPAPI operation failed")
	}
	defer kernel.NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.Data)))
	result := append([]byte(nil), unsafe.Slice(out.Data, int(out.Size))...)
	clear(unsafe.Slice(out.Data, int(out.Size)))
	return result, nil
}
func save(filename string, plain []byte) error {
	if len(plain) > 1024*1024 || !json.Valid(plain) {
		return errors.New("invalid credential JSON")
	}
	encrypted, err := protect(plain, false)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(filename), ".chatgpt-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(append(append([]byte(nil), magic...), encrypted...)); err != nil {
		file.Close()
		return err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	// Windows os.Rename uses MoveFileEx(REPLACE_EXISTING): encrypted rotation is atomic.
	return os.Rename(file.Name(), filename)
}
func load(filename string) ([]byte, error) {
	file, err := os.Open(filename)
	if errors.Is(err, os.ErrNotExist) {
		return []byte("null"), nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 2*1024*1024+1))
	if err != nil {
		return nil, err
	}
	if len(data) > 2*1024*1024 || !bytes.HasPrefix(data, magic) {
		return nil, errors.New("invalid encrypted credential file")
	}
	plain, err := protect(data[len(magic):], true)
	if err != nil {
		return nil, err
	}
	if !json.Valid(plain) {
		clear(plain)
		return nil, errors.New("invalid decrypted credentials")
	}
	return plain, nil
}
func selfTest() error {
	root, err := os.MkdirTemp("", "shortcut-dpapi-test-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(root)
	filename := filepath.Join(root, "credentials.dpapi")
	for _, fake := range []string{`{"access_token":"fake-qa-first"}`, `{"access_token":"fake-qa-rotated","refresh_token":"qa-only"}`} {
		if err := save(filename, []byte(fake)); err != nil {
			return err
		}
		stored, err := os.ReadFile(filename)
		if err != nil || bytes.Contains(stored, []byte("access_token")) {
			return errors.New("plaintext found on disk")
		}
		plain, err := load(filename)
		if err != nil || string(plain) != fake {
			return errors.New("DPAPI roundtrip failed")
		}
		stored[len(stored)-1] ^= 0xff
		if err := os.WriteFile(filename, stored, 0600); err != nil {
			return err
		}
		if _, err := load(filename); err == nil {
			return errors.New("corrupt file was accepted")
		}
	}
	if err := os.Remove(filename); err != nil {
		return err
	}
	plain, err := load(filename)
	if err != nil || string(plain) != "null" {
		return errors.New("missing credential did not reset")
	}
	fmt.Println("DPAPI self-test passed (fake credentials only)")
	return nil
}
func run() error {
	if len(os.Args) == 2 && os.Args[1] == "self-test" {
		return selfTest()
	}
	if len(os.Args) != 3 || !filepath.IsAbs(os.Args[2]) {
		return errors.New("invalid arguments")
	}
	filename := os.Args[2]
	switch os.Args[1] {
	case "read":
		plain, err := load(filename)
		if err != nil {
			return err
		}
		defer clear(plain)
		_, err = os.Stdout.Write(plain)
		return err
	case "write":
		plain, err := io.ReadAll(io.LimitReader(os.Stdin, 1024*1024+1))
		if err != nil {
			return err
		}
		defer clear(plain)
		return save(filename, plain)
	case "delete":
		err := os.Remove(filename)
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	default:
		return errors.New("invalid operation")
	}
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "ChatGPT credential storage failed. Reconnect on this Windows account.")
		os.Exit(1)
	}
}
