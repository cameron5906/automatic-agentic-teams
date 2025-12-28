import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import type { MessageContext, ToolResult } from '../types.js';
import {
  agent_list,
  agent_get_status,
  agent_get_memory,
  agent_get_definition,
  agent_nudge,
  agent_clear_nudge,
  team_get_status,
  team_get_active_milestone,
  team_get_composition,
} from '../tools/agent-tools.js';
import {
  docs_list_adrs,
  docs_list_research,
  docs_list_issue_contexts,
  docs_get_adr,
  docs_get_research,
  docs_get_issue_context,
  docs_search,
  docs_get_index,
} from '../tools/documentation-tools.js';
import {
  repo_search_code,
  repo_read_file,
  repo_list_files,
  repo_get_issue,
  repo_list_issues,
  repo_create_issue,
  repo_get_pr,
  repo_list_prs,
  repo_get_workflow_runs,
  repo_get_deployment_status,
  repo_commit_attachment,
} from '../tools/repo-tools.js';
import {
  discord_reply,
  discord_react,
  discord_create_thread,
  discord_reply_thread,
  discord_post_draft_message,
  discord_reply_to_draft,
} from '../tools/discord-tools.js';
import {
  ticket_start_flow,
  ticket_update_field,
  update_draft,
  ticket_get_draft,
  ticket_get_draft_message,
  ticket_preview,
  ticket_file_issue,
  ticket_cancel,
  ticket_decompose_epic,
  ticket_file_epic_with_children,
  ticket_list_types,
  ticket_get_field_info,
} from '../tools/ticket-tools.js';

export async function executeToolCall(
  toolCall: ChatCompletionMessageToolCall,
  context: MessageContext
): Promise<ToolResult> {
  const { name, arguments: argsString } = toolCall.function;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsString);
  } catch {
    return {
      success: false,
      error: `Failed to parse tool arguments: ${argsString}`,
    };
  }

  try {
    switch (name) {
      // Agent tools
      case 'agent_list': {
        const result = await agent_list();
        return { success: true, data: result };
      }
      case 'agent_get_status': {
        const result = await agent_get_status(args.agent_name as string);
        return { success: true, data: result };
      }
      case 'agent_get_memory': {
        const result = await agent_get_memory(args.agent_name as string);
        return { success: true, data: result };
      }
      case 'agent_get_definition': {
        const result = await agent_get_definition(args.agent_name as string);
        return { success: true, data: result };
      }
      case 'agent_nudge': {
        const result = await agent_nudge(
          args.agent_name as string,
          args.nudge as string,
          args.reason as string
        );
        return { success: true, data: result };
      }
      case 'agent_clear_nudge': {
        const result = await agent_clear_nudge(args.agent_name as string);
        return { success: true, data: result };
      }
      case 'team_get_status': {
        const result = await team_get_status();
        return { success: true, data: result };
      }
      case 'team_get_active_milestone': {
        const result = await team_get_active_milestone();
        return { success: true, data: result };
      }
      case 'team_get_composition': {
        const result = await team_get_composition();
        return { success: true, data: result };
      }

      // Documentation tools
      case 'docs_list_adrs': {
        const result = await docs_list_adrs();
        return { success: true, data: result };
      }
      case 'docs_list_research': {
        const result = await docs_list_research();
        return { success: true, data: result };
      }
      case 'docs_list_issue_contexts': {
        const result = await docs_list_issue_contexts();
        return { success: true, data: result };
      }
      case 'docs_get_adr': {
        const result = await docs_get_adr(args.identifier as string);
        return { success: true, data: result };
      }
      case 'docs_get_research': {
        const result = await docs_get_research(args.identifier as string);
        return { success: true, data: result };
      }
      case 'docs_get_issue_context': {
        const result = await docs_get_issue_context(args.issue_number as number);
        return { success: true, data: result };
      }
      case 'docs_search': {
        const result = await docs_search(
          args.query as string,
          args.doc_type as 'adr' | 'research' | 'issue-context' | undefined
        );
        return { success: true, data: result };
      }
      case 'docs_get_index': {
        const result = await docs_get_index();
        return { success: true, data: result };
      }

      // Repo tools
      case 'repo_search_code': {
        const result = await repo_search_code(
          args.query as string,
          args.file_extension as string | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_read_file': {
        const result = await repo_read_file(args.path as string);
        return { success: true, data: result };
      }
      case 'repo_list_files': {
        const result = await repo_list_files(
          args.path as string,
          args.pattern as string | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_get_issue': {
        const result = await repo_get_issue(args.issue_number as number);
        return { success: true, data: result };
      }
      case 'repo_list_issues': {
        const result = await repo_list_issues(
          args.state as 'open' | 'closed' | 'all' | undefined,
          args.labels as string[] | undefined,
          args.limit as number | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_create_issue': {
        const fastTrack = args.fast_track === true;
        const inThread = Boolean(context.threadId);

        if (!fastTrack && !inThread) {
          return {
            success: false,
            error:
              'Issue creation requires a thread unless the user explicitly asked to fast-track. Create or move to a thread first (use discord_create_thread) before filing the ticket.',
          };
        }

        const result = await repo_create_issue(
          args.title as string,
          args.body as string,
          args.labels as string[] | undefined,
          {
            channelId: context.channelId,
            threadId: context.threadId,
          }
        );
        return { success: true, data: result };
      }
      case 'repo_get_pr': {
        const result = await repo_get_pr(args.pr_number as number);
        return { success: true, data: result };
      }
      case 'repo_list_prs': {
        const result = await repo_list_prs(
          args.state as 'open' | 'closed' | 'all' | undefined,
          args.limit as number | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_get_workflow_runs': {
        const result = await repo_get_workflow_runs(
          args.workflow_name as string | undefined,
          args.status as string | undefined,
          args.limit as number | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_get_deployment_status': {
        const result = await repo_get_deployment_status(
          args.environment as string | undefined
        );
        return { success: true, data: result };
      }
      case 'repo_commit_attachment': {
        const result = await repo_commit_attachment(
          args.attachment_url as string,
          args.target_path as string,
          args.commit_message as string
        );
        return { success: true, data: result };
      }

      // Discord tools
      case 'discord_reply': {
        if (context.threadId && context.message.channelId !== context.threadId) {
          await discord_reply_thread(context, context.threadId, args.content as string);
          return { success: true, data: { replied: true, routedToThread: true } };
        }

        await discord_reply(context, args.content as string);
        return { success: true, data: { replied: true } };
      }
      case 'discord_react': {
        await discord_react(context, args.emoji as string);
        return { success: true, data: { reacted: true } };
      }
      case 'discord_create_thread': {
        const result = await discord_create_thread(
          context,
          args.name as string,
          args.initial_message as string | undefined
        );
        return { success: true, data: result };
      }
      case 'discord_reply_thread': {
        await discord_reply_thread(
          context,
          args.thread_id as string,
          args.content as string
        );
        return { success: true, data: { replied: true } };
      }
      case 'discord_post_draft_message': {
        return await discord_post_draft_message(context, args.content as string);
      }
      case 'discord_reply_to_draft': {
        return await discord_reply_to_draft(context, args.content as string);
      }

      // Ticket flow tools
      case 'ticket_start_flow': {
        return await ticket_start_flow(context, args.content as string);
      }
      case 'update_draft': {
        const value = args.value as string;
        const fieldName = args.field_name as string;
        const replyMessage = args.reply_message as string;
        const values = value.includes('\n') ? value.split('\n').filter(Boolean) : value;
        return await update_draft(context, fieldName, values, replyMessage);
      }
      case 'ticket_get_draft': {
        return ticket_get_draft(context);
      }
      case 'ticket_get_draft_message': {
        return ticket_get_draft_message(context);
      }
      case 'ticket_preview': {
        return ticket_preview(context);
      }
      case 'ticket_file_issue': {
        return await ticket_file_issue(context);
      }
      case 'ticket_cancel': {
        return ticket_cancel(context);
      }
      case 'ticket_decompose_epic': {
        return await ticket_decompose_epic(context);
      }
      case 'ticket_file_epic_with_children': {
        return await ticket_file_epic_with_children(context);
      }
      case 'ticket_list_types': {
        return ticket_list_types();
      }
      case 'ticket_get_field_info': {
        return ticket_get_field_info(
          args.issue_type as string,
          args.field_name as string
        );
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Tool execution error (${name}):`, error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
