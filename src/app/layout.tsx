import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '掼蛋教学辅助演示工具',
  description: '专业掼蛋牌局演示与教学分析平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
