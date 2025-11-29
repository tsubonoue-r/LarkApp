#!/usr/bin/env tsx

/**
 * State Transition Script
 *
 * Issue/PRの状態ラベルを遷移させるためのスクリプト
 * Usage: npm run state:transition -- --issue=123 --to=pending --reason="..."
 */

import { parseArgs } from 'node:util';

// 状態ラベルマッピング
const STATE_LABELS: Record<string, string> = {
  pending: '📥 state:pending',
  analyzing: '🔍 state:analyzing',
  implementing: '⚙️ state:implementing',
  reviewing: '👀 state:reviewing',
  testing: '🧪 state:testing',
  deploying: '🚀 state:deploying',
  done: '✅ state:done',
  blocked: '🔴 state:blocked',
};

async function main() {
  const { values } = parseArgs({
    options: {
      issue: { type: 'string' },
      to: { type: 'string' },
      reason: { type: 'string' },
    },
  });

  const issueNumber = values.issue;
  const toState = values.to;
  const reason = values.reason || 'State transition';

  if (!issueNumber || !toState) {
    console.error('Usage: npm run state:transition -- --issue=<number> --to=<state> [--reason="..."]');
    console.error('Available states:', Object.keys(STATE_LABELS).join(', '));
    process.exit(1);
  }

  const newLabel = STATE_LABELS[toState];
  if (!newLabel) {
    console.error(`Invalid state: ${toState}`);
    console.error('Available states:', Object.keys(STATE_LABELS).join(', '));
    process.exit(1);
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    console.error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN');
    process.exit(1);
  }

  try {
    // 現在のラベルを取得
    const labelsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!labelsResponse.ok) {
      throw new Error(`Failed to fetch labels: ${labelsResponse.statusText}`);
    }

    const currentLabels: Array<{ name: string }> = await labelsResponse.json();

    // 既存の状態ラベルを削除
    const stateLabelsToRemove = currentLabels
      .map(l => l.name)
      .filter(name => name.startsWith('📥') || name.startsWith('🔍') ||
                      name.startsWith('⚙️') || name.startsWith('👀') ||
                      name.startsWith('🧪') || name.startsWith('🚀') ||
                      name.startsWith('✅') || name.startsWith('🔴'));

    // 既存の状態ラベルを削除
    for (const label of stateLabelsToRemove) {
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );
    }

    // 新しい状態ラベルを追加
    const addLabelResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labels: [newLabel] }),
      }
    );

    if (!addLabelResponse.ok) {
      throw new Error(`Failed to add label: ${addLabelResponse.statusText}`);
    }

    // コメントを追加
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `🔄 **State Transition**: \`${toState}\`\n\n${reason}\n\n---\n*Automated by State Machine*`,
        }),
      }
    );

    console.log(`✅ Issue #${issueNumber} transitioned to ${toState} (${newLabel})`);
    console.log(`   Reason: ${reason}`);
  } catch (error) {
    console.error('Error during state transition:', error);
    process.exit(1);
  }
}

main();
