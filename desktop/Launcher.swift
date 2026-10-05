import AppKit
import Foundation

final class StudioApp: NSObject, NSApplicationDelegate {
    private var runner: Process?
    private var statusItem: NSStatusItem?
    private var readyTimer: Timer?
    private var didOpen = false
    private var quitting = false
    private var logHandle: FileHandle?
    private let webURL = URL(string: "http://127.0.0.1:5173/")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        menu.addItem(withTitle: "Mở ShortCut Studio", action: #selector(openBrowser), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "Xem log", action: #selector(openLog), keyEquivalent: "").target = self
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Thoát ShortCut Studio…", action: #selector(quitApp), keyEquivalent: "q").target = self
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "film.stack", accessibilityDescription: "ShortCut Studio")
        item.button?.toolTip = "ShortCut Studio — Đang khởi động"
        item.menu = menu
        statusItem = item
        guard let resources = Bundle.main.resourceURL else { showError("Không tìm thấy dữ liệu app."); return }
        do {
            try FileManager.default.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
            logHandle = try FileHandle(forWritingTo: logURL)
            try logHandle?.truncate(atOffset: 0)
            let process = Process()
            process.executableURL = resources.appendingPathComponent("runtime/bin/node")
            process.arguments = [resources.appendingPathComponent("desktop/bootstrap.mjs").path]
            process.currentDirectoryURL = resources.appendingPathComponent("app")
            process.standardOutput = logHandle
            process.standardError = logHandle
            process.terminationHandler = { [weak self] task in
                DispatchQueue.main.async {
                    guard let self = self, !self.quitting else { return }
                    self.readyTimer?.invalidate()
                    let detail = (try? String(contentsOf: self.logURL, encoding: .utf8)) ?? ""
                    self.showError("App đã dừng (\(task.terminationStatus)).\n\n\(String(detail.suffix(1800)))")
                }
            }
            runner = process
            try process.run()
            readyTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                guard let self = self, !self.didOpen else { return }
                let log = (try? String(contentsOf: self.logURL, encoding: .utf8)) ?? ""
                if log.contains("SHORTCUT_READY") {
                    self.didOpen = true
                    self.readyTimer?.invalidate()
                    self.statusItem?.button?.toolTip = "ShortCut Studio — Đang chạy"
                    self.openBrowser()
                }
            }
        } catch { showError(error.localizedDescription) }
    }

    private var logURL: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/ShortCut Studio/launcher.log")
    }
    @objc private func openBrowser() { NSWorkspace.shared.open(webURL) }
    @objc private func openLog() { NSWorkspace.shared.open(logURL) }
    @objc private func quitApp() { NSApplication.shared.terminate(nil) }

    private func showError(_ text: String) {
        let alert = NSAlert()
        alert.messageText = "Không chạy được ShortCut Studio"
        alert.informativeText = text
        alert.addButton(withTitle: "Đóng")
        alert.addButton(withTitle: "Xem log")
        NSApplication.shared.activate(ignoringOtherApps: true)
        if alert.runModal() == .alertSecondButtonReturn { openLog() }
        quitting = true
        NSApplication.shared.terminate(nil)
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if !quitting && runner?.isRunning == true {
            let alert = NSAlert()
            alert.messageText = "Thoát ShortCut Studio?"
            alert.informativeText = "Nếu đang render, tác vụ sẽ bị dừng. Video đã xuất hoàn tất vẫn được giữ. Đóng tab trình duyệt thì app vẫn tiếp tục chạy."
            alert.addButton(withTitle: "Thoát và dừng app")
            alert.addButton(withTitle: "Tiếp tục chạy")
            if alert.runModal() != .alertFirstButtonReturn { return .terminateCancel }
        }
        quitting = true
        readyTimer?.invalidate()
        if let task = runner, task.isRunning {
            task.terminate()
            DispatchQueue.global().async {
                task.waitUntilExit()
                DispatchQueue.main.async { sender.reply(toApplicationShouldTerminate: true) }
            }
            return .terminateLater
        }
        return .terminateNow
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if didOpen { openBrowser() }
        return false
    }
}

let app = NSApplication.shared
let delegate = StudioApp()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
