import fs from 'node:fs/promises';
import path from 'node:path';
import { clusterHome } from '@cluster/shared';
import type {
  SkillManifest,
  InstalledSkill,
  SkillInvocationRecord,
  SkillFilterOptions,
} from '@cluster/shared';
import { MARKETPLACE_CATALOG } from './catalog.js';
import { createSkillManifest, validateSkillManifest } from './manifest.js';

interface SkillsStorageSchema {
  version: number;
  installed: Record<string, InstalledSkill>;
  custom: Record<string, SkillManifest>;
}

export class SkillsStore {
  private readonly baseDir: string;
  private readonly storePath: string;
  private readonly historyPath: string;
  private initialized = false;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(clusterHome(), 'skills');
    this.storePath = path.join(this.baseDir, 'skills.json');
    this.historyPath = path.join(this.baseDir, 'history.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.baseDir, { recursive: true });

    try {
      await fs.access(this.storePath);
    } catch {
      // Seed default installed skills from builtins
      const initial: SkillsStorageSchema = {
        version: 1,
        installed: {},
        custom: {},
      };

      // Auto-install top 6 core builtins by default
      const defaultInstalledIds = [
        'refactor-clean',
        'test-suite-gen',
        'bug-hunter',
        'ui-tailwind-framer',
        'code-review-security',
        'architect-planner',
      ];

      const now = new Date().toISOString();
      for (const id of defaultInstalledIds) {
        const item = MARKETPLACE_CATALOG.find((s) => s.id === id);
        if (item) {
          initial.installed[item.id] = {
            manifest: item,
            enabled: true,
            pinned: id === 'refactor-clean' || id === 'bug-hunter',
            installedAt: now,
            updatedAt: now,
            invocationCount: 0,
          };
        }
      }

      await fs.writeFile(this.storePath, JSON.stringify(initial, null, 2), 'utf8');
    }

    try {
      await fs.access(this.historyPath);
    } catch {
      await fs.writeFile(this.historyPath, JSON.stringify([], null, 2), 'utf8');
    }

    this.initialized = true;
  }

  private async readStore(): Promise<SkillsStorageSchema> {
    await this.init();
    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { version: 1, installed: {}, custom: {} };
    }
  }

  private async writeStore(data: SkillsStorageSchema): Promise<void> {
    await this.init();
    await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async listInstalled(): Promise<InstalledSkill[]> {
    const store = await this.readStore();
    return Object.values(store.installed).sort((a, b) => {
      // Pinned first, then by invocation count desc, then name
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.invocationCount !== b.invocationCount) return b.invocationCount - a.invocationCount;
      return a.manifest.displayName.localeCompare(b.manifest.displayName);
    });
  }

  async getInstalled(idOrCmd: string): Promise<InstalledSkill | null> {
    const clean = idOrCmd.toLowerCase().replace(/^\//, '').trim();
    const installed = await this.listInstalled();
    return (
      installed.find(
        (s) =>
          s.manifest.id.toLowerCase() === clean ||
          s.manifest.invocationName.toLowerCase() === clean ||
          (s.manifest.supportedCommands &&
            s.manifest.supportedCommands.some((c) => c.toLowerCase().replace(/^\//, '') === clean)),
      ) || null
    );
  }

  async listMarketplace(options: SkillFilterOptions = {}): Promise<(SkillManifest & { isInstalled: boolean })[]> {
    const store = await this.readStore();
    const installedIds = new Set(Object.keys(store.installed));
    const allCatalog = [...MARKETPLACE_CATALOG, ...Object.values(store.custom)];

    let filtered = allCatalog.map((manifest) => ({
      ...manifest,
      isInstalled: installedIds.has(manifest.id),
    }));

    if (options.category && options.category !== 'all') {
      filtered = filtered.filter((s) => s.category === options.category);
    }

    if (options.source && options.source !== 'all') {
      filtered = filtered.filter((s) => s.installSource === options.source);
    }

    if (options.installedOnly) {
      filtered = filtered.filter((s) => s.isInstalled);
    }

    if (options.tag) {
      const t = options.tag.toLowerCase();
      filtered = filtered.filter((s) => s.tags.some((tag) => tag.toLowerCase().includes(t)));
    }

    if (options.search) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.invocationName.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q) ||
          s.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    // Sort
    switch (options.sortBy) {
      case 'name':
        filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'rating':
        filtered.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case 'recent':
        filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case 'popularity':
      default:
        filtered.sort((a, b) => b.stats.downloads - a.stats.downloads);
        break;
    }

    return filtered;
  }

  async install(skillId: string): Promise<{ ok: boolean; skill?: InstalledSkill; error?: string }> {
    const store = await this.readStore();
    if (store.installed[skillId]) {
      return { ok: true, skill: store.installed[skillId] };
    }

    const manifest =
      MARKETPLACE_CATALOG.find((s) => s.id === skillId) ||
      store.custom[skillId];

    if (!manifest) {
      return { ok: false, error: `Skill "${skillId}" not found in marketplace catalog.` };
    }

    const now = new Date().toISOString();
    const installed: InstalledSkill = {
      manifest,
      enabled: true,
      pinned: false,
      installedAt: now,
      updatedAt: now,
      invocationCount: 0,
    };

    store.installed[skillId] = installed;
    await this.writeStore(store);
    return { ok: true, skill: installed };
  }

  async uninstall(skillId: string): Promise<boolean> {
    const store = await this.readStore();
    if (!store.installed[skillId]) return false;
    delete store.installed[skillId];
    await this.writeStore(store);
    return true;
  }

  async update(skillId: string): Promise<InstalledSkill | null> {
    const store = await this.readStore();
    const target = store.installed[skillId];
    if (!target) return null;

    const catalogItem = MARKETPLACE_CATALOG.find((s) => s.id === skillId);
    if (!catalogItem) return target;

    target.manifest = catalogItem;
    target.updatedAt = new Date().toISOString();
    await this.writeStore(store);
    return target;
  }

  async toggle(skillId: string, enabled: boolean): Promise<boolean> {
    const store = await this.readStore();
    if (!store.installed[skillId]) return false;
    store.installed[skillId].enabled = enabled;
    await this.writeStore(store);
    return true;
  }

  async pin(skillId: string, pinned: boolean): Promise<boolean> {
    const store = await this.readStore();
    if (!store.installed[skillId]) return false;
    store.installed[skillId].pinned = pinned;
    await this.writeStore(store);
    return true;
  }

  async createCustom(data: Partial<SkillManifest> & { displayName: string; invocationName: string; instructions: string }): Promise<InstalledSkill> {
    const store = await this.readStore();
    const id = `custom-${data.invocationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const manifest = createSkillManifest({
      ...data,
      id,
      name: id,
      category: data.category || 'coding',
      installSource: 'custom',
    });

    store.custom[id] = manifest;

    const now = new Date().toISOString();
    const installed: InstalledSkill = {
      manifest,
      enabled: true,
      pinned: true,
      installedAt: now,
      updatedAt: now,
      invocationCount: 0,
    };
    store.installed[id] = installed;

    await this.writeStore(store);
    return installed;
  }

  async recordInvocation(
    skillId: string,
    params: Record<string, any>,
    rawCommand: string,
    sessionId: string,
    status: 'success' | 'failed' | 'cancelled' = 'success',
    error?: string,
  ): Promise<void> {
    const store = await this.readStore();
    const skill = store.installed[skillId];
    if (skill) {
      skill.invocationCount = (skill.invocationCount || 0) + 1;
      skill.lastInvokedAt = new Date().toISOString();
      await this.writeStore(store);
    }

    const record: SkillInvocationRecord = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      skillId,
      skillName: skill?.manifest.displayName || skillId,
      invocationName: skill?.manifest.invocationName || skillId,
      sessionId,
      params,
      rawCommand,
      invokedAt: new Date().toISOString(),
      status,
      error,
    };

    try {
      const historyRaw = await fs.readFile(this.historyPath, 'utf8').catch(() => '[]');
      const history: SkillInvocationRecord[] = JSON.parse(historyRaw);
      history.unshift(record);
      // keep latest 200 invocations
      await fs.writeFile(this.historyPath, JSON.stringify(history.slice(0, 200), null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  async getHistory(limit = 50): Promise<SkillInvocationRecord[]> {
    try {
      const raw = await fs.readFile(this.historyPath, 'utf8');
      const items: SkillInvocationRecord[] = JSON.parse(raw);
      return items.slice(0, limit);
    } catch {
      return [];
    }
  }

  async stats(): Promise<{
    installedCount: number;
    marketplaceCount: number;
    totalInvocations: number;
    pinnedCount: number;
  }> {
    const installed = await this.listInstalled();
    const marketplace = await this.listMarketplace();
    const invocations = installed.reduce((sum, s) => sum + (s.invocationCount || 0), 0);
    const pinnedCount = installed.filter((s) => s.pinned).length;

    return {
      installedCount: installed.length,
      marketplaceCount: marketplace.length,
      totalInvocations: invocations,
      pinnedCount,
    };
  }
}
