import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { MessageContext, AgentResult, BotState } from '../types';
import { createChatCompletion, extractApprovalIntent } from '../services/openai';
import { config } from '../config';
import * as conversationStore from '../context/conversation-store';
import * as projectStore from '../context/project-store';
import { allTools, getToolsByNames } from '../tools';
import { getStateConfig } from '../state/types';
import { routeMessage, shouldAutoTransition } from '../state/router';
import { transition } from '../state/machine';
import { buildSystemPrompt, buildContextSummary } from './system-prompt';
import {
  executeToolCall,
  getPendingApproval,
  clearPendingApproval,
  executeApprovedTool,
} from './tool-executor';

const MAX_ITERATIONS = 15;

export async function runAgent(
  userMessage: string,
  context: MessageContext
): Promise<AgentResult> {
  const contextKey = conversationStore.getContextKey(context.channelId, context.threadId);

  const pendingApproval = getPendingApproval(contextKey);
  if (pendingApproval) {
    const approvalIntent = await extractApprovalIntent(userMessage);

    if (approvalIntent.isApproval && approvalIntent.confidence > 0.7) {
      const result = await executeApprovedTool(contextKey, pendingApproval, context.authorId);

      conversationStore.addMessage(contextKey, 'user', userMessage, context.authorId, context.authorName);

      const responseContent = result.success
        ? `Approved! ${JSON.stringify(result.data)}`
        : `Failed: ${result.error}`;

      conversationStore.addMessage(contextKey, 'assistant', responseContent);

      return {
        response: result.success
          ? `Done! ${(result.data as { message?: string })?.message ?? 'Action completed successfully.'}`
          : `Sorry, that failed: ${result.error}`,
        toolsUsed: [pendingApproval.toolName],
        iterations: 1,
      };
    } else if (approvalIntent.isRejection && approvalIntent.confidence > 0.7) {
      clearPendingApproval(contextKey);

      conversationStore.addMessage(contextKey, 'user', userMessage, context.authorId, context.authorName);
      conversationStore.addMessage(contextKey, 'assistant', 'Understood, I\'ve cancelled that action.');

      return {
        response: 'No problem, I\'ve cancelled that. What would you like to do instead?',
        toolsUsed: [],
        iterations: 1,
      };
    }
  }

  const messageWithContext = context.replyContext
    ? `${context.replyContext}\n\n${userMessage}`
    : userMessage;

  conversationStore.addMessage(contextKey, 'user', messageWithContext, context.authorId, context.authorName);

  let currentState = conversationStore.getState(contextKey);

  if (currentState === 'idle') {
    currentState = 'chat';
    conversationStore.setState(contextKey, 'chat');
  }

  const conversationMessages = conversationStore.getMessagesForOpenAI(contextKey);
  const contextSummary = buildContextSummary(
    conversationMessages.map((m) => ({ role: m.role, content: m.content }))
  );

  const routeResult = await routeMessage(currentState, userMessage, contextSummary);

  if (routeResult.stateChanged && routeResult.confidence > 0.7) {
    currentState = routeResult.newState;
    conversationStore.setState(contextKey, currentState);
  }

  const projectId = conversationStore.getProjectId(contextKey);
  const activeProject = projectId ? projectStore.getProject(projectId) : null;

  const stateConfig = getStateConfig(currentState);
  const availableTools = stateConfig.allowedTools.length > 0
    ? getToolsByNames(stateConfig.allowedTools)
    : allTools;

  const systemPrompt = buildSystemPrompt(currentState, activeProject);

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationMessages.slice(-20) as ChatCompletionMessageParam[],
  ];

  const toolsUsed: string[] = [];
  let iterations = 0;
  let finalResponse = '';

  for (iterations = 0; iterations < MAX_ITERATIONS; iterations++) {
    const response = await createChatCompletion({
      model: config.openai.model,
      messages,
      tools: availableTools.length > 0 ? availableTools : undefined,
      temperature: 0.7,
    });

    const choice = response.choices[0];
    if (!choice) {
      finalResponse = 'I encountered an issue processing your request.';
      break;
    }

    const assistantMessage = choice.message;

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalResponse = assistantMessage.content ?? '';
      break;
    }

    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;

      let toolArgs: Record<string, unknown>;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error(`Failed to parse tool arguments for ${toolName}:`, parseError);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: 'Invalid tool arguments: malformed JSON',
          }),
        });
        continue;
      }

      toolsUsed.push(toolName);

      const result = await executeToolCall(toolName, toolArgs, context);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });

      if (result.requiresApproval) {
        finalResponse = result.approvalPrompt ?? 'I need your approval to proceed.';
        iterations = MAX_ITERATIONS;
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS - 1) {
      break;
    }
  }

  const autoTransition = shouldAutoTransition(currentState, toolsUsed, finalResponse);
  let newState: BotState | undefined;

  if (autoTransition) {
    newState = transition(currentState, autoTransition);
    if (newState !== currentState) {
      conversationStore.setState(contextKey, newState);
    }
  }

  conversationStore.addMessage(contextKey, 'assistant', finalResponse);

  return {
    response: finalResponse,
    toolsUsed: [...new Set(toolsUsed)],
    iterations: iterations + 1,
    newState,
  };
}

export async function handleMention(
  message: string,
  context: MessageContext
): Promise<string> {
  try {
    const result = await runAgent(message, context);
    return result.response;
  } catch (error) {
    console.error('Agent error:', error);
    return 'Sorry, I encountered an error processing your request. Please try again.';
  }
}
