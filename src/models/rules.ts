export type TriggerType = "keyword" | "regex";
export type ActionType = "reply" | "react";

export interface Rule {
	id: number;
	triggerType: TriggerType;
	triggerValue: string;
	action: ActionType;
	value: string;
	chat: string;
	enabled: boolean;
	hitCount: number;
	lastFired: Date | null;
}

export interface RuleInput {
	triggerType: TriggerType;
	triggerValue: string;
	action: ActionType;
	value: string;
	chat: string;
}
