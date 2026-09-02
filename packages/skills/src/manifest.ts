import { z } from 'zod';
import type { SkillManifest, SkillCategory, SkillEntryType, SkillPermission } from '@cluster/shared';

export const SkillCategorySchema = z.enum([
  'coding',
  'refactor',
  'review',
  'debugging',
  'docs',
  'ui',
  'electron',
  'memory',
  'provider',
  'workflow',
  'automation',
  'planning',
  'testing',
  'deployment',
  'project_setup',
  'migration',
]);

export const SkillEntryTypeSchema = z.enum(['prompt', 'workflow', 'tool', 'composite']);

export const SkillPermissionSchema = z.enum([
  'fs:read',
  'fs:write',
  'cmd:exec',
  'memory',
  'network',
  'workspace',
]);

export const SkillParamDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'file']),
  description: z.string().min(1),
  required: z.boolean().optional(),
  default: z.any().optional(),
});

export const SkillWorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: z.string().optional(),
  tool: z.string().optional(),
  action: z.string().min(1),
  required: z.boolean().optional(),
});

export const SkillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  tags: z.array(z.string()).default([]),
  category: SkillCategorySchema,
  entryType: SkillEntryTypeSchema,
  invocationName: z.string().min(1).regex(/^[a-z0-9-_]+$/i, 'Invocation name must be alphanumeric'),
  supportedCommands: z.array(z.string()).optional(),
  requiredPermissions: z.array(SkillPermissionSchema).default([]),
  requiredTools: z.array(z.string()).default([]),
  modelCompatibility: z.union([z.array(z.string()), z.literal('all')]).default('all'),
  installSource: z.enum(['builtin', 'marketplace', 'custom']).default('builtin'),
  instructions: z.string().min(1),
  workflow: z.array(SkillWorkflowStepSchema).optional(),
  defaultParams: z.array(SkillParamDefinitionSchema).optional(),
  securityFlags: z
    .object({
      isVerified: z.boolean().default(true),
      isSafe: z.boolean().default(true),
      communityReviewed: z.boolean().optional(),
    })
    .default({ isVerified: true, isSafe: true }),
  stats: z
    .object({
      downloads: z.number().default(0),
      rating: z.number().default(5.0),
      invocations: z.number().default(0),
    })
    .default({ downloads: 0, rating: 5.0, invocations: 0 }),
  icon: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export function validateSkillManifest(input: unknown): { ok: true; manifest: SkillManifest } | { ok: false; error: string } {
  const result = SkillManifestSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error?.issues ?? (result.error as any)?.errors ?? [];
    return {
      ok: false,
      error:
        issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join('; ') ||
        result.error?.message ||
        'Invalid manifest',
    };
  }
  return { ok: true, manifest: result.data as SkillManifest };
}

export function createSkillManifest(data: Partial<SkillManifest> & { id: string; name: string; displayName: string; category: SkillCategory; invocationName: string; instructions: string }): SkillManifest {
  const now = new Date().toISOString();
  return {
    id: data.id,
    name: data.name,
    displayName: data.displayName,
    version: data.version || '1.0.0',
    description: data.description || data.displayName,
    author: data.author || 'Cluster Community',
    tags: data.tags || [data.category],
    category: data.category,
    entryType: data.entryType || 'prompt',
    invocationName: data.invocationName.toLowerCase(),
    supportedCommands: data.supportedCommands || [`/${data.invocationName.toLowerCase()}`],
    requiredPermissions: data.requiredPermissions || ['fs:read', 'fs:write'],
    requiredTools: data.requiredTools || ['read_file', 'write_file', 'patch_file'],
    modelCompatibility: data.modelCompatibility || 'all',
    installSource: data.installSource || 'builtin',
    instructions: data.instructions,
    workflow: data.workflow,
    defaultParams: data.defaultParams,
    securityFlags: data.securityFlags || { isVerified: true, isSafe: true },
    stats: data.stats || { downloads: 100, rating: 5.0, invocations: 0 },
    icon: data.icon,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}
