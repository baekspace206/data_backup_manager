# SaveMyData iOS App 구현 가이드

## 개요
기존 웹 UI를 WKWebView로 로딩하고, 파일 업로드를 URLSession background configuration으로 처리하여 앱이 백그라운드에 있어도 업로드가 계속되는 iOS 앱

## 프로젝트 구조

```
SaveMyData/
├── SaveMyDataApp.swift              -- SwiftUI 앱 진입점
├── AppDelegate.swift                -- 백그라운드 URLSession 재연결
├── Models/
│   ├── ServerConfig.swift           -- 서버 URL 저장 (UserDefaults)
│   └── UploadItem.swift             -- 업로드 상태 모델
├── Services/
│   ├── BackgroundUploadManager.swift -- URLSession 백그라운드 업로드 엔진
│   ├── MultipartFormDataBuilder.swift -- multipart/form-data 파일 생성
│   ├── NotificationService.swift     -- 알림 진행률 표시
│   └── PhotoPickerService.swift      -- PHPicker 사진 선택
├── WebView/
│   ├── WebViewController.swift       -- WKWebView 호스트
│   └── WebViewBridge.swift           -- JS <-> Native 브릿지
└── Views/
    ├── MainView.swift                -- 루트 뷰
    ├── SetupView.swift               -- 최초 서버 URL 입력
    ├── WebContainerView.swift        -- UIViewControllerRepresentable
    └── UploadProgressOverlay.swift   -- 업로드 진행률 오버레이
```

## Xcode 프로젝트 생성

1. Xcode > File > New > Project
2. iOS > App 선택
3. Product Name: SaveMyData
4. Interface: SwiftUI
5. Language: Swift
6. Deployment Target: iOS 16.0

---

## 핵심 동작 흐름

```
사용자가 WebView 업로드 영역 터치
    ↓
주입된 JS가 <input type="file"> 클릭 가로챔
    ↓
Native PHPickerViewController로 사진/동영상 선택
    ↓
선택된 파일을 임시 디렉토리에 복사
    ↓
MultipartFormDataBuilder로 multipart body를 디스크 파일로 생성
    ↓
URLSession background uploadTask(with:fromFile:) 실행
    ↓
앱이 백그라운드로 전환되어도 iOS가 업로드 관리
    ↓
완료 시 알림 표시 + WebView 갱신
```

## 백엔드 API 정보

- POST /api/uploads/files (multipart/form-data, field: "files", 최대 10개, 파일당 500MB)
- GET /api/uploads/files (목록 조회, query: date, type, limit, offset)
- GET /api/uploads/files/:id (파일 다운로드)
- DELETE /api/uploads/files/:id (파일 삭제)
- GET /api/uploads/thumbnails/:id (썸네일)
- GET /api/uploads/stats (통계)
- 허용 타입: image(jpeg,png,gif,webp,heic), video(mp4,mov,avi,quicktime)

---

## Info.plist 필수 설정

```xml
<!-- 사진 라이브러리 접근 -->
<key>NSPhotoLibraryUsageDescription</key>
<string>사진과 비디오를 백업 서버에 업로드하기 위해 사진 라이브러리 접근이 필요합니다.</string>

<!-- 로컬 네트워크 접근 (라즈베리파이) -->
<key>NSLocalNetworkUsageDescription</key>
<string>로컬 네트워크의 SaveMyData 서버에 연결하기 위해 필요합니다.</string>

<!-- Bonjour (.local 호스트명 지원) -->
<key>NSBonjourServices</key>
<array>
    <string>_http._tcp.</string>
</array>

<!-- HTTP 허용 (라즈베리파이는 HTTPS 아님) -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>

<!-- 백그라운드 모드 -->
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>
```

---

## 구현 순서

1. Xcode 프로젝트 생성 (SwiftUI, iOS 16.0+)
2. ServerConfig + SetupView (서버 URL 설정)
3. WebViewController + WebContainerView (웹 UI 로딩)
4. WebViewBridge + JS 주입 (업로드 인터셉트)
5. PhotoPickerService (사진 라이브러리 접근)
6. MultipartFormDataBuilder (multipart body 파일 생성)
7. BackgroundUploadManager (백그라운드 업로드)
8. NotificationService (알림 진행률)
9. UploadProgressOverlay (앱 내 진행률 UI)

---

## 소스 코드

### 1. SaveMyDataApp.swift

```swift
import SwiftUI

@main
struct SaveMyDataApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            MainView()
        }
    }
}
```

### 2. AppDelegate.swift

```swift
import UIKit

class AppDelegate: NSObject, UIApplicationDelegate {
    var backgroundSessionCompletionHandler: (() -> Void)?

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        backgroundSessionCompletionHandler = completionHandler
        _ = BackgroundUploadManager.shared
    }
}
```

### 3. Models/ServerConfig.swift

```swift
import Foundation

final class ServerConfig: ObservableObject {
    static let shared = ServerConfig()

    private let key = "SaveMyData_ServerURL"

    @Published var serverURL: URL? {
        didSet {
            if let url = serverURL {
                UserDefaults.standard.set(url.absoluteString, forKey: key)
            } else {
                UserDefaults.standard.removeObject(forKey: key)
            }
        }
    }

    var isConfigured: Bool { serverURL != nil }

    private init() {
        if let saved = UserDefaults.standard.string(forKey: key),
           let url = URL(string: saved) {
            self.serverURL = url
        }
    }

    func validateServer(urlString: String) async throws -> Bool {
        guard let baseURL = URL(string: urlString) else {
            throw ServerConfigError.invalidURL
        }

        let testURL = baseURL.appendingPathComponent("api/uploads/stats")
        let (_, response) = try await URLSession.shared.data(from: testURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ServerConfigError.serverUnreachable
        }

        return true
    }

    enum ServerConfigError: LocalizedError {
        case invalidURL
        case serverUnreachable

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "잘못된 URL 형식입니다"
            case .serverUnreachable: return "서버에 연결할 수 없습니다"
            }
        }
    }
}
```

### 4. Models/UploadItem.swift

```swift
import Foundation

struct UploadItem: Identifiable {
    let id: String
    let taskIdentifier: String
    var fileName: String
    var totalBytes: Int64
    var sentBytes: Int64
    var status: UploadStatus

    var progress: Double {
        guard totalBytes > 0 else { return 0 }
        return Double(sentBytes) / Double(totalBytes)
    }

    init(taskIdentifier: String, fileName: String, totalBytes: Int64, sentBytes: Int64, status: UploadStatus) {
        self.id = taskIdentifier
        self.taskIdentifier = taskIdentifier
        self.fileName = fileName
        self.totalBytes = totalBytes
        self.sentBytes = sentBytes
        self.status = status
    }

    enum UploadStatus {
        case pending
        case uploading
        case completed
        case failed(String)
    }
}
```

### 5. Services/BackgroundUploadManager.swift

```swift
import Foundation
import UIKit

final class BackgroundUploadManager: NSObject, ObservableObject {
    static let shared = BackgroundUploadManager()

    static let sessionIdentifier = "com.savemydata.backgroundUpload"

    @Published var activeUploads: [String: UploadItem] = [:]

    private lazy var backgroundSession: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.allowsCellularAccess = true
        config.shouldUseExtendedBackgroundIdleMode = true
        config.timeoutIntervalForResource = 60 * 60 // 1시간
        return URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }()

    private override init() {
        super.init()
        _ = backgroundSession
    }

    /// 단일 파일 업로드
    func uploadFile(fileURL: URL, originalFilename: String, mimeType: String) {
        guard let serverBaseURL = ServerConfig.shared.serverURL else { return }

        let boundary = "Boundary-\(UUID().uuidString)"
        let uploadURL = serverBaseURL.appendingPathComponent("api/uploads/files")

        var request = URLRequest(url: uploadURL)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        // 백그라운드 업로드는 반드시 파일 기반이어야 함
        let bodyFileURL = MultipartFormDataBuilder.buildMultipartFile(
            boundary: boundary,
            fieldName: "files",
            fileName: originalFilename,
            mimeType: mimeType,
            fileURL: fileURL
        )

        let task = backgroundSession.uploadTask(with: request, fromFile: bodyFileURL)
        task.taskDescription = bodyFileURL.absoluteString // 임시파일 경로 저장 (정리용)

        let item = UploadItem(
            taskIdentifier: "\(task.taskIdentifier)",
            fileName: originalFilename,
            totalBytes: (try? FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as? Int64) ?? 0,
            sentBytes: 0,
            status: .uploading
        )

        activeUploads["\(task.taskIdentifier)"] = item
        task.resume()

        NotificationService.shared.showUploadStarted(fileName: originalFilename)
    }

    /// 여러 파일 업로드 (파일당 개별 요청 - 안정성 우선)
    func uploadFiles(fileInfos: [(url: URL, filename: String, mimeType: String)]) {
        for info in fileInfos {
            uploadFile(fileURL: info.url, originalFilename: info.filename, mimeType: info.mimeType)
        }
    }
}

// MARK: - URLSessionDelegate
extension BackgroundUploadManager: URLSessionDelegate {
    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
               let handler = appDelegate.backgroundSessionCompletionHandler {
                appDelegate.backgroundSessionCompletionHandler = nil
                handler()
            }
        }
    }
}

// MARK: - URLSessionTaskDelegate
extension BackgroundUploadManager: URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didSendBodyData bytesSent: Int64,
                    totalBytesSent: Int64,
                    totalBytesExpectedToSend: Int64) {
        let key = "\(task.taskIdentifier)"
        DispatchQueue.main.async {
            self.activeUploads[key]?.sentBytes = totalBytesSent
            self.activeUploads[key]?.totalBytes = totalBytesExpectedToSend

            let progress = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
            let fileName = self.activeUploads[key]?.fileName ?? "File"
            NotificationService.shared.updateUploadProgress(
                taskId: key, fileName: fileName, progress: progress
            )
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didCompleteWithError error: Error?) {
        let key = "\(task.taskIdentifier)"
        DispatchQueue.main.async {
            if let error = error {
                self.activeUploads[key]?.status = .failed(error.localizedDescription)
                NotificationService.shared.showUploadFailed(
                    fileName: self.activeUploads[key]?.fileName ?? "File",
                    error: error.localizedDescription
                )
            } else {
                self.activeUploads[key]?.status = .completed
                NotificationService.shared.showUploadCompleted(
                    fileName: self.activeUploads[key]?.fileName ?? "File"
                )
            }

            // 임시 multipart 파일 정리
            if let tempPath = task.taskDescription,
               let tempURL = URL(string: tempPath) {
                try? FileManager.default.removeItem(at: tempURL)
            }

            // 3초 후 목록에서 제거
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self.activeUploads.removeValue(forKey: key)
            }
        }
    }
}

// MARK: - URLSessionDataDelegate
extension BackgroundUploadManager: URLSessionDataDelegate {
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask,
                    didReceive data: Data) {
        if let responseString = String(data: data, encoding: .utf8) {
            print("Server response: \(responseString)")
        }
    }
}
```

### 6. Services/MultipartFormDataBuilder.swift

```swift
import Foundation

enum MultipartFormDataBuilder {

    /// multipart/form-data body를 디스크 파일로 생성
    /// 백그라운드 URLSession uploadTask는 파일 기반만 지원
    static func buildMultipartFile(
        boundary: String,
        fieldName: String,
        fileName: String,
        mimeType: String,
        fileURL: URL
    ) -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let tempFileURL = tempDir.appendingPathComponent("upload-\(UUID().uuidString).multipart")

        FileManager.default.createFile(atPath: tempFileURL.path, contents: nil)
        let fileHandle = try! FileHandle(forWritingTo: tempFileURL)

        defer { fileHandle.closeFile() }

        // Part 헤더
        let header = [
            "--\(boundary)\r\n",
            "Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n",
            "Content-Type: \(mimeType)\r\n",
            "\r\n"
        ].joined()

        fileHandle.write(header.data(using: .utf8)!)

        // 파일 내용 - 1MB 청크로 스트리밍 (메모리 절약)
        let inputStream = InputStream(url: fileURL)!
        inputStream.open()
        defer { inputStream.close() }

        let bufferSize = 1024 * 1024 // 1MB
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while inputStream.hasBytesAvailable {
            let bytesRead = inputStream.read(buffer, maxLength: bufferSize)
            if bytesRead > 0 {
                fileHandle.write(Data(bytes: buffer, count: bytesRead))
            } else {
                break
            }
        }

        // 종료 boundary
        let footer = "\r\n--\(boundary)--\r\n"
        fileHandle.write(footer.data(using: .utf8)!)

        return tempFileURL
    }
}
```

### 7. Services/PhotoPickerService.swift

```swift
import PhotosUI
import UniformTypeIdentifiers

final class PhotoPickerService: NSObject {
    static let shared = PhotoPickerService()

    private var completion: ([(url: URL, filename: String, mimeType: String)]) -> Void = { _ in }

    func presentPicker(
        from viewController: UIViewController,
        completion: @escaping ([(url: URL, filename: String, mimeType: String)]) -> Void
    ) {
        self.completion = completion

        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.selectionLimit = 10
        config.filter = .any(of: [.images, .videos])
        config.preferredAssetRepresentationMode = .current // HEIC 변환 방지

        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        viewController.present(picker, animated: true)
    }
}

extension PhotoPickerService: PHPickerViewControllerDelegate {
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard !results.isEmpty else {
            completion([])
            return
        }

        var fileInfos: [(url: URL, filename: String, mimeType: String)] = []
        let group = DispatchGroup()

        let imageTypes: [UTType] = [.heic, .jpeg, .png, .gif, .webP]
        let videoTypes: [UTType] = [.quickTimeMovie, .mpeg4Movie, .avi, .movie]

        for result in results {
            let provider = result.itemProvider

            var matchedType: UTType?
            for type in (imageTypes + videoTypes) {
                if provider.hasRepresentationConforming(toTypeIdentifier: type.identifier) {
                    matchedType = type
                    break
                }
            }

            guard let utType = matchedType else { continue }

            group.enter()

            provider.loadFileRepresentation(forTypeIdentifier: utType.identifier) { url, error in
                defer { group.leave() }
                guard let sourceURL = url else { return }

                // PHPicker 임시 URL은 콜백 종료 후 삭제됨 -> 복사 필요
                let destDir = FileManager.default.temporaryDirectory
                    .appendingPathComponent("SaveMyDataPending", isDirectory: true)
                try? FileManager.default.createDirectory(at: destDir, withIntermediateDirectories: true)

                let destURL = destDir.appendingPathComponent(sourceURL.lastPathComponent)
                try? FileManager.default.removeItem(at: destURL)

                do {
                    try FileManager.default.copyItem(at: sourceURL, to: destURL)

                    let mimeType = Self.mimeType(for: utType)
                    let filename = provider.suggestedName ?? sourceURL.lastPathComponent
                    let ext = destURL.pathExtension
                    let fullFilename = filename.hasSuffix(".\(ext)") ? filename : "\(filename).\(ext)"

                    fileInfos.append((url: destURL, filename: fullFilename, mimeType: mimeType))
                } catch {
                    print("Failed to copy picked file: \(error)")
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.completion(fileInfos)
        }
    }

    private static func mimeType(for utType: UTType) -> String {
        switch utType {
        case .jpeg: return "image/jpeg"
        case .png: return "image/png"
        case .gif: return "image/gif"
        case .webP: return "image/webp"
        case .heic: return "image/heic"
        case .mpeg4Movie: return "video/mp4"
        case .quickTimeMovie: return "video/quicktime"
        case .avi: return "video/x-msvideo"
        case .movie: return "video/quicktime"
        default: return utType.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
```

### 8. Services/NotificationService.swift

```swift
import UserNotifications

final class NotificationService {
    static let shared = NotificationService()

    private let center = UNUserNotificationCenter.current()

    func requestPermission() {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            print("Notification permission: \(granted)")
        }
    }

    func showUploadStarted(fileName: String) {
        let content = UNMutableNotificationContent()
        content.title = "업로드 시작"
        content.body = "\(fileName) 업로드를 시작합니다"

        let request = UNNotificationRequest(
            identifier: "upload-start-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        center.add(request)
    }

    func updateUploadProgress(taskId: String, fileName: String, progress: Double) {
        let percentage = Int(progress * 100)
        guard percentage % 25 == 0 && percentage > 0 && percentage < 100 else { return }

        let content = UNMutableNotificationContent()
        content.title = "업로드 중..."
        content.body = "\(fileName): \(percentage)% 완료"

        let request = UNNotificationRequest(
            identifier: "upload-progress-\(taskId)",
            content: content,
            trigger: nil
        )
        center.add(request)
    }

    func showUploadCompleted(fileName: String) {
        let content = UNMutableNotificationContent()
        content.title = "업로드 완료"
        content.body = "\(fileName) 업로드가 완료되었습니다"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "upload-done-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        center.add(request)

        NotificationCenter.default.post(name: .uploadCompleted, object: nil)
    }

    func showUploadFailed(fileName: String, error: String) {
        let content = UNMutableNotificationContent()
        content.title = "업로드 실패"
        content.body = "\(fileName): \(error)"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "upload-fail-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        center.add(request)
    }
}

extension Notification.Name {
    static let uploadCompleted = Notification.Name("SaveMyDataUploadCompleted")
}
```

### 9. WebView/WebViewBridge.swift

```swift
import WebKit

final class WebViewBridge: NSObject, WKScriptMessageHandler {

    weak var webView: WKWebView?
    weak var viewController: UIViewController?

    enum MessageName: String, CaseIterable {
        case uploadFiles = "saveMyDataUpload"
        case openPhotoPicker = "saveMyDataPhotoPicker"
        case log = "saveMyDataLog"
    }

    func register(in configuration: WKWebViewConfiguration) {
        let controller = configuration.userContentController

        for name in MessageName.allCases {
            controller.add(self, name: name.rawValue)
        }

        let script = WKUserScript(
            source: Self.injectedJavaScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        controller.addUserScript(script)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let messageName = MessageName(rawValue: message.name) else { return }

        switch messageName {
        case .uploadFiles:
            presentPhotoPicker()
        case .openPhotoPicker:
            presentPhotoPicker()
        case .log:
            if let logMessage = message.body as? String {
                print("[WebView JS] \(logMessage)")
            }
        }
    }

    private func presentPhotoPicker() {
        guard let vc = viewController else { return }
        PhotoPickerService.shared.presentPicker(from: vc) { [weak self] results in
            guard !results.isEmpty else { return }
            BackgroundUploadManager.shared.uploadFiles(fileInfos: results)
            self?.notifyWebUploadStarted(fileCount: results.count)
        }
    }

    func notifyWebUploadStarted(fileCount: Int) {
        let js = "window.__saveMyDataBridge?.onNativeUploadStarted(\(fileCount));"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func notifyWebUploadCompleted() {
        let js = "window.__saveMyDataBridge?.onNativeUploadCompleted();"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - 주입할 JavaScript

    static let injectedJavaScript = """
    (function() {
        'use strict';

        // Native <-> JS 통신 브릿지
        window.__saveMyDataBridge = {
            onNativeUploadStarted: function(fileCount) {
                console.log('[SaveMyData Bridge] Native upload started for ' + fileCount + ' files');
                window.dispatchEvent(new CustomEvent('savemydata-upload-started', {
                    detail: { fileCount: fileCount }
                }));
            },
            onNativeUploadCompleted: function() {
                console.log('[SaveMyData Bridge] Native upload completed');
                window.dispatchEvent(new CustomEvent('savemydata-upload-completed'));
                window.dispatchEvent(new Event('savemydata-refresh'));
            }
        };

        // XHR 인터셉트 - /api/uploads/files POST 요청 가로채기
        var OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            var xhr = new OriginalXHR();
            var originalOpen = xhr.open.bind(xhr);
            var originalSend = xhr.send.bind(xhr);
            var intercepted = false;
            var uploadUrl = '';

            xhr.open = function(method, url) {
                uploadUrl = url;
                if (method.toUpperCase() === 'POST' &&
                    (url.indexOf('/api/uploads/files') !== -1)) {
                    intercepted = true;
                }
                return originalOpen.apply(xhr, arguments);
            };

            xhr.send = function(body) {
                if (intercepted && body instanceof FormData) {
                    console.log('[SaveMyData Bridge] Intercepted upload XHR');
                    window.webkit.messageHandlers.saveMyDataUpload.postMessage({
                        reason: 'xhr_intercepted',
                        url: uploadUrl
                    });

                    // React UI가 멈추지 않도록 가짜 성공 응답 전송
                    setTimeout(function() {
                        Object.defineProperty(xhr, 'status', { value: 200, writable: false });
                        Object.defineProperty(xhr, 'responseText', {
                            value: JSON.stringify({ files: [] }),
                            writable: false
                        });
                        xhr.dispatchEvent(new Event('load'));
                    }, 500);
                    return;
                }
                return originalSend.apply(xhr, arguments);
            };

            return xhr;
        };
        window.XMLHttpRequest.prototype = OriginalXHR.prototype;

        // file input 클릭 인터셉트
        document.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
                e.preventDefault();
                e.stopPropagation();
                window.webkit.messageHandlers.saveMyDataPhotoPicker.postMessage({});
                return false;
            }
        }, true);

        // 프로그래밍 방식 file input 클릭 인터셉트
        var originalClick = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() {
            if (this.type === 'file') {
                window.webkit.messageHandlers.saveMyDataPhotoPicker.postMessage({});
                return;
            }
            return originalClick.apply(this, arguments);
        };

        console.log('[SaveMyData Bridge] Injection complete');
    })();
    """
}
```

### 10. WebView/WebViewController.swift

```swift
import UIKit
import WebKit

class WebViewController: UIViewController {

    private var webView: WKWebView!
    private let bridge = WebViewBridge()

    override func viewDidLoad() {
        super.viewDidLoad()

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        bridge.register(in: config)
        bridge.viewController = self

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        bridge.webView = webView

        view.addSubview(webView)
        loadServerURL()

        NotificationCenter.default.addObserver(
            self, selector: #selector(handleUploadCompleted),
            name: .uploadCompleted, object: nil
        )
    }

    func loadServerURL() {
        guard let serverURL = ServerConfig.shared.serverURL else { return }
        webView.load(URLRequest(url: serverURL))
    }

    @objc private func handleUploadCompleted() {
        bridge.notifyWebUploadCompleted()
    }
}

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        print("Navigation failed: \(error.localizedDescription)")
    }
}
```

### 11. Views/MainView.swift

```swift
import SwiftUI

struct MainView: View {
    @ObservedObject var config = ServerConfig.shared
    @ObservedObject var uploadManager = BackgroundUploadManager.shared

    var body: some View {
        ZStack {
            if config.isConfigured {
                WebContainerView()
                    .edgesIgnoringSafeArea(.all)
                    .overlay(alignment: .top) {
                        if !uploadManager.activeUploads.isEmpty {
                            UploadProgressOverlay(uploads: uploadManager.activeUploads)
                        }
                    }
            } else {
                SetupView()
            }
        }
        .onAppear {
            NotificationService.shared.requestPermission()
        }
    }
}
```

### 12. Views/SetupView.swift

```swift
import SwiftUI

struct SetupView: View {
    @ObservedObject var config = ServerConfig.shared
    @State private var urlText: String = "http://192.168."
    @State private var isValidating = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "cloud.fill")
                .font(.system(size: 60))
                .foregroundColor(.blue)

            Text("SaveMyData")
                .font(.largeTitle.bold())

            Text("라즈베리파이 서버 주소를 입력하세요")
                .foregroundColor(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                TextField("http://192.168.0.100", text: $urlText)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.URL)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                }
            }
            .padding(.horizontal)

            Button(action: validateAndSave) {
                if isValidating {
                    ProgressView()
                } else {
                    Text("연결")
                        .bold()
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isValidating || urlText.isEmpty)
            .padding(.horizontal)

            Text("예: http://192.168.0.100")
                .font(.caption)
                .foregroundColor(.secondary)

            Spacer()
        }
        .padding()
    }

    private func validateAndSave() {
        isValidating = true
        errorMessage = nil

        Task {
            do {
                let _ = try await config.validateServer(urlString: urlText)
                config.serverURL = URL(string: urlText)
            } catch {
                errorMessage = error.localizedDescription
            }
            isValidating = false
        }
    }
}
```

### 13. Views/WebContainerView.swift

```swift
import SwiftUI

struct WebContainerView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController {
        return WebViewController()
    }

    func updateUIViewController(_ uiViewController: WebViewController, context: Context) {}
}
```

### 14. Views/UploadProgressOverlay.swift

```swift
import SwiftUI

struct UploadProgressOverlay: View {
    let uploads: [String: UploadItem]

    var body: some View {
        VStack(spacing: 8) {
            ForEach(Array(uploads.values)) { item in
                HStack(spacing: 12) {
                    statusIcon(for: item.status)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.fileName)
                            .font(.caption)
                            .lineLimit(1)

                        ProgressView(value: item.progress)
                            .tint(tintColor(for: item.status))
                    }

                    Text("\(Int(item.progress * 100))%")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .frame(width: 35)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
        }
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(radius: 4)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func statusIcon(for status: UploadItem.UploadStatus) -> some View {
        Group {
            switch status {
            case .uploading, .pending:
                Image(systemName: "arrow.up.circle.fill")
                    .foregroundColor(.blue)
            case .completed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
            }
        }
    }

    private func tintColor(for status: UploadItem.UploadStatus) -> Color {
        switch status {
        case .uploading, .pending: return .blue
        case .completed: return .green
        case .failed: return .red
        }
    }
}
```

---

## 검증 방법

1. Xcode에서 프로젝트 생성 후 위 Swift 파일들 추가
2. 시뮬레이터에서 서버 URL 설정 화면 확인
3. WebView로 웹 UI 정상 로딩 확인
4. 업로드 영역 터치 시 네이티브 사진 피커 표시 확인
5. 실제 디바이스에서 사진 업로드 후 백그라운드 전환 테스트
6. 업로드 완료 알림 수신 확인
