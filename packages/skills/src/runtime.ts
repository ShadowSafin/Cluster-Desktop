import type { InstalledSkill, SkillManifest } from '@cluster/shared';
import { SkillsStore } from './store.js';
import { MARKETPLACE_CATALOG } from './catalog.js';

export type SkillResolution =
  | {
      type: 'system';
      action: 'list' | 'marketplace' | 'install' | 'remove';
      target?: string;
    }
  | {
      type: 'skill';
      skill: InstalledSkill;
      params: Record<string, any>;
      rawArgs: string;
      augmentedPrompt: string;
      instructions: string;
    }
  | {
      type: 'missing';
      command: string;
      suggestion?: SkillManifest;
    }
  | {
      type: 'none';
    };

export class SkillsRuntime {
  constructor(private readonly store: SkillsStore) {}

  /**
   * Parse user input to check for slash-command invocation.
   */
  async resolveCommand(input: string): Promise<SkillResolution> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { type: 'none' };
    }

    const match = /^\/([a-z0-9-_]+)(?:\s+(.*))?$/i.exec(trimmed);
    if (!match) {
      return { type: 'none' };
    }

    const command = match[1].toLowerCase();
    const rawArgs = match[2]?.trim() || '';

    // Check system commands
    if (command === 'skills') {
      return { type: 'system', action: 'list' };
    }
    if (command === 'marketplace') {
      return { type: 'system', action: 'marketplace' };
    }
    if (command === 'install') {
      return { type: 'system', action: 'install', target: rawArgs };
    }
    if (command === 'remove' || command === 'uninstall') {
      return { type: 'system', action: 'remove', target: rawArgs };
    }

    // Check installed skills
    const installed = await this.store.getInstalled(command);
    if (installed && installed.enabled) {
      const params = this.parseParams(installed.manifest, rawArgs);
      const instructions = this.buildSkillInstructions(installed.manifest, params, rawArgs);
      const augmentedPrompt = rawArgs
        ? `[Skill: /${command} (${installed.manifest.displayName})] ${rawArgs}`
        : `[Skill: /${command} (${installed.manifest.displayName})] Execute skill workflow.`;

      return {
        type: 'skill',
        skill: installed,
        params,
        rawArgs,
        augmentedPrompt,
        instructions,
      };
    }

    // Not installed — check if it's available in the marketplace catalog
    const marketplaceMatch = MARKETPLACE_CATALOG.find(
      (s) =>
        s.invocationName.toLowerCase() === command ||
        (s.supportedCommands &&
          s.supportedCommands.some((c) => c.toLowerCase().replace(/^\//, '') === command)),
    );

    return {
      type: 'missing',
      command,
      suggestion: marketplaceMatch,
    };
  }

  /**
   * Parse parameters from command line args based on skill manifest.
   */
  private parseParams(manifest: SkillManifest, rawArgs: string): Record<string, any> {
    const params: Record<string, any> = {};
    if (!rawArgs) return params;

    const defs = manifest.defaultParams || [];
    const tokens = rawArgs.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    if (defs.length > 0) {
      for (let i = 0; i < defs.length && i < tokens.length; i++) {
        const def = defs[i];
        let val: any = tokens[i].replace(/^["']|["']$/g, '');
        if (def.type === 'number') val = Number(val);
        else if (def.type === 'boolean') val = val === 'true' || val === '1';
        params[def.name] = val;
      }
    } else {
      params['target'] = rawArgs;
    }

    return params;
  }

  /**
   * Build instructions and workflow directives to inject into the agent loop.
   */
  private buildSkillInstructions(
    manifest: SkillManifest,
    params: Record<string, any>,
    rawArgs: string,
  ): string {
    const sections: string[] = [
      `## Active Skill: ${manifest.displayName} (/${manifest.invocationName})`,
      `**Category**: ${manifest.category} | **Author**: ${manifest.author} | **Version**: v${manifest.version}`,
      manifest.description,
      '',
      '### Skill Instructions',
      manifest.instructions,
    ];

    if (manifest.workflow && manifest.workflow.length > 0) {
      sections.push('', '### Prescribed Skill Workflow');
      for (const [idx, step] of manifest.workflow.entries()) {
        sections.push(
          `${idx + 1}. **${step.title}**: ${step.action}${step.tool ? ` (Use tool: ${step.tool})` : ''}`,
        );
      }
    }

    if (Object.keys(params).length > 0) {
      sections.push('', '### Invocation Parameters', JSON.stringify(params, null, 2));
    } else if (rawArgs) {
      sections.push('', '### Target / Context', rawArgs);
    }

    return sections.join('\n');
  }
}
