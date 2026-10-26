# 掼蛋教学辅助演示工具

正式网站：https://pai.dufengyun.xyz

## 保存、备份与云端

- 「保存牌局」先保存到当前浏览器 localStorage，无需数据库；刷新后在「历史记录」加载。
- 本机存档按网站域名隔离，请固定使用正式网址。无痕模式、清除网站数据或更换浏览器不会保留本机存档。
- 「导出备份」下载 JSON；在另一台设备或浏览器用「导入备份」恢复。导入会合并，保留已有较新的同编号牌局。
- 「读取云端」按每批 50 条读取旧存档并缓存到本机；「同步此牌局到云端」手动备份单条存档。日常保存、打开历史记录均不唤醒数据库。
- 云端 402 表示 Neon 账户/项目额度受限；失败会明确提示，且保留本机存档。数据库限制需在 Neon 控制台解除；删除存档不能恢复已耗尽的计算时长。
- 不自动删除任何存档。删除云端存档失败时，界面不会假装删除成功。

## 数据库初始化（只在新建数据库时执行一次）

配置 `DATABASE_URL`（或 `POSTGRES_URL`），并由管理员执行：

```sql
CREATE TABLE IF NOT EXISTS guandan_snapshots (
  snapshot_id VARCHAR(255) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  data JSONB NOT NULL,
  remark VARCHAR(255)
);
```

现有数据库无需迁移。每次保存/读取不再发送 CREATE TABLE。不要在数据库仍受限或未备份时盲目清理数据。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
