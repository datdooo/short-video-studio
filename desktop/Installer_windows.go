package main

import (
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "net"
 "os"
 "os/exec"
 "path/filepath"
 "strconv"
 "strings"
 "syscall"
 "time"
)

var releaseVersion = "1.1.0-beta.1"
var releaseCommit = "unknown"
const installID = "local.datdo.shortcutstudio.beta"
const uninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShortCutStudioBeta`
type installReceipt struct { ID, Version, Commit, SHA256 string }

func betaBusy() bool {
 h,_,_ := kernel.NewProc("OpenMutexW").Call(0x00100000,0,ptr(`Local\ShortCutStudio.Beta.Windows.SingleInstance`))
 if h!=0 { syscall.CloseHandle(syscall.Handle(h)); return true }
 for _,port:=range []string{"5373","8987"} { c,e:=net.DialTimeout("tcp","127.0.0.1:"+port,300*time.Millisecond); if e==nil { c.Close(); return true } }
 return false
}
func powershell(script string, extra map[string]string) error {
 command:=exec.Command(filepath.Join(os.Getenv("SystemRoot"),"System32","WindowsPowerShell","v1.0","powershell.exe"),"-NoProfile","-NonInteractive","-Command",script)
 command.Env=os.Environ();for k,v:=range extra {command.Env=append(command.Env,k+"="+v)}
 command.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 if out,e:=command.CombinedOutput();e!=nil{return fmt.Errorf("Windows setup: %v: %s",e,string(out))};return nil
}
func installation() (bool,error) {
 executable,e:=os.Executable();if e!=nil{return true,e}
 uninstall:=len(os.Args)>1&&os.Args[1]=="--uninstall"
 install:=strings.Contains(strings.ToLower(filepath.Base(executable)),"-setup-")||(len(os.Args)>1&&os.Args[1]=="--install")
 if !install&&!uninstall{return false,nil}
 local:=os.Getenv("LOCALAPPDATA");if !filepath.IsAbs(local){return true,fmt.Errorf("LOCALAPPDATA is missing")}
 root:=filepath.Join(local,"Programs","ShortCut Studio Beta")
 target:=filepath.Join(root,"ShortCut Studio Beta.exe");receiptPath:=filepath.Join(root,"install-receipt.json")
 var previous installReceipt
 data,readErr:=os.ReadFile(receiptPath)
 owned:=readErr==nil&&json.Unmarshal(data,&previous)==nil&&previous.ID==installID
 if betaBusy(){return true,fmt.Errorf("Save your work and Quit ShortCut Studio Beta before installing or uninstalling. No process was stopped.")}
 if uninstall {
  if !owned||!strings.EqualFold(executable,target){return true,fmt.Errorf("No matching Beta installation; refusing removal")}
  if message("Uninstall ShortCut Studio Beta? Media, drafts, credentials, history and runtime data under LocalAppData will be kept.",0x24)!=6{return true,nil}
  // Remove only our installed files/shortcuts after this uninstaller exits.
  command:=exec.Command(filepath.Join(os.Getenv("SystemRoot"),"System32","WindowsPowerShell","v1.0","powershell.exe"),"-NoProfile","-NonInteractive","-Command",`$ErrorActionPreference='Stop'; Wait-Process -Id ([int]$env:SHORTCUT_BETA_UNINSTALL_PID) -ErrorAction SilentlyContinue; $w=New-Object -ComObject WScript.Shell; foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$p=Join-Path $folder 'ShortCut Studio Beta.lnk'; if(Test-Path -LiteralPath $p){if($w.CreateShortcut($p).TargetPath -eq $env:SHORTCUT_BETA_INSTALL_EXE){Remove-Item -LiteralPath $p}}}; Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ShortCutStudioBeta' -ErrorAction SilentlyContinue; foreach($p in @($env:SHORTCUT_BETA_INSTALL_EXE,($env:SHORTCUT_BETA_INSTALL_EXE+'.previous'),(Join-Path $env:SHORTCUT_BETA_INSTALL_ROOT 'install-receipt.json'),(Join-Path $env:SHORTCUT_BETA_INSTALL_ROOT 'previous-install-receipt.json'))){if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p}}; if((Get-ChildItem -LiteralPath $env:SHORTCUT_BETA_INSTALL_ROOT -Force | Measure-Object).Count -eq 0){[IO.Directory]::Delete($env:SHORTCUT_BETA_INSTALL_ROOT)}`)
  command.Env=append(os.Environ(),"SHORTCUT_BETA_UNINSTALL_PID="+strconv.Itoa(os.Getpid()),"SHORTCUT_BETA_INSTALL_EXE="+target,"SHORTCUT_BETA_INSTALL_ROOT="+root)
  command.SysProcAttr=&syscall.SysProcAttr{HideWindow:true,CreationFlags:0x00000008}
  return true,command.Start()
 }
 if message("Install ShortCut Studio Beta "+releaseVersion+" for this Windows account? A Desktop/Start Menu shortcut and uninstall entry will be created. DEV/production data will not be imported.",0x24)!=6{return true,nil}
 // Refuse an existing unowned destination or a redirected installation path.
 for cursor:=root;len(cursor)>=len(local);cursor=filepath.Dir(cursor){if info,err:=os.Lstat(cursor);err==nil&&(info.Mode()&os.ModeSymlink!=0||!info.IsDir()){return true,fmt.Errorf("Unsafe installation path: %s",cursor)};if strings.EqualFold(cursor,local){break}}
 if entries,err:=os.ReadDir(root);err==nil&&len(entries)>0&&!owned{return true,fmt.Errorf("Existing directory is not owned by this Beta installer")}
 if strings.EqualFold(executable,target){return true,fmt.Errorf("Run the separate Beta Setup file to update this installation")}
 if e:=os.MkdirAll(root,0700);e!=nil{return true,e}
 source,e:=os.ReadFile(executable);if e!=nil{return true,e};digest:=sha256.Sum256(source)
 stage,e:=os.CreateTemp(root,".beta-install-*.tmp");if e!=nil{return true,e};stageName:=stage.Name();defer os.Remove(stageName)
 if _,e=stage.Write(source);e!=nil{stage.Close();return true,e};if e=stage.Sync();e!=nil{stage.Close();return true,e};if e=stage.Close();e!=nil{return true,e}
 verify,e:=os.ReadFile(stageName);if e!=nil||sha256.Sum256(verify)!=digest{return true,fmt.Errorf("Installer copy verification failed")}
 if owned {
  if e=os.Remove(target+".previous");e!=nil&&!os.IsNotExist(e){return true,e}
  if e=os.Rename(target,target+".previous");e!=nil{return true,e}
  if e=os.WriteFile(filepath.Join(root,"previous-install-receipt.json"),data,0600);e!=nil{os.Rename(target+".previous",target);return true,e}
 }
 if e=os.Rename(stageName,target);e!=nil{if owned{os.Rename(target+".previous",target)};return true,e}
 receipt,_:=json.MarshalIndent(installReceipt{installID,releaseVersion,releaseCommit,hex.EncodeToString(digest[:])},"","  ")
 if e=os.WriteFile(receiptPath,receipt,0600);e!=nil{return true,e}
 if e=powershell(`$ErrorActionPreference='Stop'; $w=New-Object -ComObject WScript.Shell; foreach($folder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))){$p=Join-Path $folder 'ShortCut Studio Beta.lnk'; if(Test-Path -LiteralPath $p){if($w.CreateShortcut($p).TargetPath -ne $env:SHORTCUT_BETA_INSTALL_EXE){throw 'Existing shortcut is not owned by Beta'}}; $s=$w.CreateShortcut($p);$s.TargetPath=$env:SHORTCUT_BETA_INSTALL_EXE;$s.WorkingDirectory=$env:SHORTCUT_BETA_INSTALL_ROOT;$s.Description='ShortCut Studio Beta';$s.Save()}`,map[string]string{"SHORTCUT_BETA_INSTALL_EXE":target,"SHORTCUT_BETA_INSTALL_ROOT":root});e!=nil{return true,e}
 values:=map[string]string{"DisplayName":"ShortCut Studio Beta","DisplayVersion":releaseVersion,"Publisher":"ShortCut Studio","InstallLocation":root,"DisplayIcon":target,"UninstallString":syscall.EscapeArg(target)+" --uninstall"}
 for k,v:=range values {c:=exec.Command("reg.exe","add",uninstallKey,"/v",k,"/t","REG_SZ","/d",v,"/f");c.SysProcAttr=&syscall.SysProcAttr{HideWindow:true};if out,e:=c.CombinedOutput();e!=nil{return true,fmt.Errorf("Uninstall registration: %v: %s",e,out)}}
 c:=exec.Command(target);c.SysProcAttr=&syscall.SysProcAttr{CreationFlags:0x00000010};return true,c.Start()
}
