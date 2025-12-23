export const enum AccountStatus {
	Active = 'active',
	Takendown = 'takendown',
	Suspended = 'suspended',
	Deleted = 'deleted',
	Deactivated = 'deactivated',
}

export const formatAccountStatus = (
	account: null | {
		takedown_ref: string | null;
		deactivated_at: Date | null;
	},
) => {
	if (account === null) {
		return { active: false, status: AccountStatus.Deleted } as const;
	}
	if (account.takedown_ref) {
		return { active: false, status: AccountStatus.Takendown } as const;
	}
	if (account.deactivated_at) {
		return { active: false, status: AccountStatus.Deactivated } as const;
	}

	return { active: true, status: undefined } as const;
};
