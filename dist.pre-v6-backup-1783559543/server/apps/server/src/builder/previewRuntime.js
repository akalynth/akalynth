// Shared in-process builder preview runtime state (store, sessions, bindings).
import { BuilderDraftNamespaceStore } from './draftNamespace.js';
import { PreviewSessionBindingStore } from './previewSessionBinding.js';
export const builderPreviewStore = new BuilderDraftNamespaceStore();
export const builderPreviewSessions = new Map();
export const builderPreviewBindings = new PreviewSessionBindingStore();
