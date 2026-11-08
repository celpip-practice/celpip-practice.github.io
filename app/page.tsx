"use client";
import Link from "next/link";
import { useIndex } from "@/components/useTests";
import { displayTitle } from "@/lib/content";

export default function Home() {
  const { tests, error } = useIndex();
  return (
    <main className="page">
      <h1>CELPIP Open Practice</h1>
      <p className="lead">官方真题 · 还原真实考试界面的在线模考 + 听说读写分项练习（本地版）</p>
      <div className="grid two">
        <Link href="/exam/" className="card mode-card" data-testid="mode-exam">
          <h2>📝 模拟考试</h2>
          <p>完全按真实考试流程：听力 → 阅读 → 写作 → 口语。限时、录音只播放一次、不能返回，结束后出成绩和逐题解析。</p>
        </Link>
        <Link href="/practice/" className="card mode-card" data-testid="mode-practice">
          <h2>🎯 分项练习</h2>
          <p>按听、说、读、写分开，逐个 Part 练习。可以重听、显示播放条、随时看答案和听力原文、写作范文。</p>
        </Link>
      </div>

      <h2 style={{ marginTop: 32 }}>题库</h2>
      {error && <p className="warn-box">无法加载题库：{error}。请先运行 <code>npm run content:build</code>。</p>}
      {!tests && !error && <p className="muted">加载中…</p>}
      <div className="grid tests">
        {tests?.map((t) => (
          <div className="card" key={t.id} data-testid={`test-${t.id}`}>
            <b>{displayTitle(t)}</b>
            <div className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>{t.title}</div>
            <div className="row">
              <Link className="btn primary small" href={`/exam/?test=${t.id}`}>模考</Link>
              <Link className="btn small" href={`/practice/?test=${t.id}`}>分项练习</Link>
              {t.warnings > 0 && <span className="pill warn">{t.warnings} 条提示</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
