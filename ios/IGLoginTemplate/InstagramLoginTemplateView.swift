import SwiftUI

struct InstagramLoginTemplateView: View {
    @StateObject private var store = LoginRecordsStore()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    Text("中文(台灣)")
                        .font(.system(size: 15))
                        .foregroundStyle(.secondary)
                        .padding(.top, 18)
                        .padding(.bottom, 42)

                    InstagramMark()
                        .frame(width: 86, height: 86)
                        .padding(.bottom, 36)

                    VStack(spacing: 12) {
                        RoundedInputField(
                            placeholder: "用戶名稱、電子郵件地址或手機號碼",
                            text: $store.username
                        )

                        RoundedInputField(
                            placeholder: "遮罩欄",
                            text: $store.note,
                            isSecure: true
                        )

                        Button {
                            store.submit()
                        } label: {
                            Text("登入")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 54)
                                .background(
                                    LinearGradient(
                                        colors: [Color(red: 0.10, green: 0.46, blue: 0.94), Color(red: 0.05, green: 0.41, blue: 0.91)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .clipShape(Capsule())
                        }
                        .padding(.top, 2)

                        Text("忘記密碼？")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.primary)
                            .padding(.top, 2)

                        Text(store.submissionStatus)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.teal)
                            .frame(minHeight: 20)
                    }
                    .padding(.horizontal, 22)

                    DividerRow()
                        .padding(.top, 18)
                        .padding(.bottom, 16)

                    Button {
                    } label: {
                        Text("建立新帳號")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color(red: 0.10, green: 0.46, blue: 0.94))
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .overlay(
                                Capsule()
                                    .stroke(Color(red: 0.10, green: 0.46, blue: 0.94), lineWidth: 1.4)
                            )
                    }
                    .padding(.horizontal, 22)

                    LoginRecordsPreview(records: store.records)
                        .padding(.top, 20)

                    MetaFooter()
                        .padding(.top, 18)
                        .padding(.bottom, 18)
                }
            }
            .background(Color.white.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
        }
    }
}

private struct DividerRow: View {
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color(red: 0.88, green: 0.88, blue: 0.9)).frame(height: 1)
            Text("或").font(.system(size: 13, weight: .bold)).foregroundStyle(.secondary)
            Rectangle().fill(Color(red: 0.88, green: 0.88, blue: 0.9)).frame(height: 1)
        }
        .padding(.horizontal, 22)
    }
}

private struct RoundedInputField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false

    var body: some View {
        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .font(.system(size: 16))
        .padding(.horizontal, 18)
        .frame(height: 54)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color(red: 0.86, green: 0.86, blue: 0.88), lineWidth: 1))
        .padding(.horizontal, 22)
    }
}

private struct LoginRecordsPreview: View {
    let records: [LoginRecord]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("後台預覽")
                .font(.headline)
                .padding(.horizontal, 22)

            VStack(spacing: 10) {
                ForEach(records.prefix(3)) { record in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(record.username).font(.headline)
                            Text(record.note).font(.subheadline).foregroundStyle(.secondary)
                            Text(record.time).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(record.status).font(.subheadline.weight(.semibold)).foregroundStyle(.blue)
                    }
                    .padding(14)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .padding(.horizontal, 22)
                }
            }
        }
    }
}

private struct InstagramMark: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.98, green: 0.85, blue: 0.35),
                            Color(red: 0.97, green: 0.49, blue: 0.12),
                            Color(red: 0.83, green: 0.16, blue: 0.46),
                            Color(red: 0.59, green: 0.18, blue: 0.75),
                            Color(red: 0.31, green: 0.36, blue: 0.84)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.white)
                .padding(4)
            Circle().stroke(Color(red: 0.99, green: 0.43, blue: 0.42), lineWidth: 4).frame(width: 30, height: 30)
            Circle().fill(Color(red: 0.97, green: 0.43, blue: 0.42)).frame(width: 8, height: 8).offset(x: 18, y: -18)
        }
        .shadow(color: .black.opacity(0.08), radius: 12, y: 6)
    }
}

private struct MetaFooter: View {
    var body: some View {
        HStack(spacing: 6) {
            Text("∞").font(.system(size: 22, weight: .semibold)).foregroundStyle(Color(red: 0.10, green: 0.46, blue: 0.94))
            Text("Meta").font(.system(size: 18)).foregroundStyle(.primary)
        }
    }
}

#Preview {
    InstagramLoginTemplateView()
}
