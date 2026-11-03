import path from 'node:path';
import {resolveRuntime,runtimeEnvironment} from './runtime-config.mjs';
export function windowsEnvironment(resources,current){
 const p=path.win32,runtime=resolveRuntime({profile:'beta',platform:'win32',localAppData:current.LOCALAPPDATA,supportRoot:current.SHORTCUT_BETA_SUPPORT_ROOT});
 const appRoot=p.join(resources,'app'),dataRoot=runtime.dataRoot,bin=p.join(resources,'runtime','bin'),fontConfig=p.join(dataRoot,'fontconfig.xml');
 const escape=v=>v.replaceAll('\\','/').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const fontXml=`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${escape(p.join(appRoot,'public'))}</dir><dir>${escape(p.join(current.SystemRoot||'C:\\Windows','Fonts'))}</dir><cachedir>${escape(p.join(dataRoot,'cache','fontconfig'))}</cachedir></fontconfig>`;
 const env=runtimeEnvironment(runtime,current);for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];
 Object.assign(env,{PATH:`${bin};${current.PATH||current.Path||''}`,NODE_ENV:'production',FFMPEG_PATH:p.join(bin,'ffmpeg.exe'),FFPROBE_PATH:p.join(bin,'ffprobe.exe'),WHISPER_PATH:p.join(bin,'whisper-cli.exe'),YT_DLP_PATH:p.join(bin,'yt-dlp.exe'),FONTCONFIG_FILE:fontConfig});
 return{runtime,appRoot,dataRoot,fontConfig,fontXml,env};
}
