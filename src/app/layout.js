export const metadata = {
  title: 'CA Script Generator',
  description: 'キャリアアドバイザー向けスクリプト生成ツール',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
