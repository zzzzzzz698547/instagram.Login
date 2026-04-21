import Foundation
import SwiftUI

struct LoginRecord: Identifiable, Hashable {
    let id = UUID()
    let time: String
    let username: String
    let note: String
    let status: String
    let source: String
}

final class LoginRecordsStore: ObservableObject {
    @Published var username = ""
    @Published var note = ""
    @Published var submissionStatus = ""
    @Published var records: [LoginRecord] = [
        LoginRecord(time: "今天 09:20", username: "demo_user", note: "測試A", status: "登入嘗試", source: "iPhone 登入頁"),
        LoginRecord(time: "今天 10:08", username: "sample01", note: "測試B", status: "登入成功", source: "iPhone 登入頁")
    ]

    func submit() {
        let record = LoginRecord(
            time: Self.formatter.string(from: .now),
            username: username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "未填寫" : username,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "未填寫" : note,
            status: "登入嘗試",
            source: "iPhone 登入頁"
        )

        records.insert(record, at: 0)
        submissionStatus = "已送出安全紀錄，後台可查看。"
        username = ""
        note = ""

        if records.count > 50 {
            records = Array(records.prefix(50))
        }
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_TW")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}
