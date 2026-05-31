// Re-export the OTel workflow interceptors so they bundle into the workflow
// sandbox. Register this module with WorkerOptions.interceptors.workflowModules.
export { interceptors } from '@temporalio/interceptors-opentelemetry/lib/workflow-interceptors.js';
