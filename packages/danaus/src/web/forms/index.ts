import { AsyncLocalStorage } from 'node:async_hooks';

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// #region types
export interface FormIssue {
	path: (string | number)[];
	message: string;
}

interface FormState {
	input: Record<string, unknown>;
	/** flattened issues map keyed by path string, '$' contains all issues */
	issues: Record<string, FormIssue[]>;
	result?: unknown;
}

interface FormConfig {
	id: string;
	action: string;
}

interface FormStore {
	definitions: WeakMap<FormDefinition<any, any>, FormConfig>;
	state: Map<string, FormState>;
}

interface FormHandlerStore {
	context: Context;
}

export interface FormDefinition<TInput, TOutput> {
	/** the form action URL */
	readonly action: string;
	/** the form method */
	readonly method: 'post';
	/** proxy for accessing field values and issues */
	readonly fields: FieldsProxy<TInput>;
	/** the result of the form handler, if successful */
	readonly result: TOutput | undefined;
	/** internal metadata */
	readonly __: {
		schema: StandardSchemaV1<TInput>;
		handler: (data: TInput, issue: IssueBuilder<TInput>) => Promise<TOutput>;
	};
}

export type IssueBuilder<T> = {
	[K in keyof T]: T[K] extends Record<string, unknown>
		? IssueBuilder<T[K]> & ((message: string) => FormIssue)
		: (message: string) => FormIssue;
} & ((message: string) => FormIssue);

export type FieldsProxy<T> = {
	[K in keyof T]: T[K] extends Record<string, unknown> ? FieldsProxy<T[K]> & FieldAccessor : FieldAccessor;
} & FieldAccessor;

export interface FieldAccessor {
	/** returns the current input value for this field */
	value(): unknown;
	/** returns validation issues for this exact field path */
	issues(): { path: (string | number)[]; message: string }[];
	/** returns validation issues for this field and all nested fields */
	allIssues(): { path: (string | number)[]; message: string }[];
	/** returns props for an input element */
	as(type: InputType, inputValue?: string): Record<string, unknown>;
}

type InputType =
	| 'text'
	| 'email'
	| 'password'
	| 'number'
	| 'range'
	| 'search'
	| 'tel'
	| 'url'
	| 'hidden'
	| 'submit'
	| 'checkbox'
	| 'radio'
	| 'select'
	| 'select multiple'
	| 'file'
	| 'file multiple';
// #endregion

// #region async local storage
const formStore = new AsyncLocalStorage<FormStore>();
const formHandlerStore = new AsyncLocalStorage<FormHandlerStore>();

const getFormConfig = (form: FormDefinition<any, any>): FormConfig | undefined => {
	return formStore.getStore()?.definitions.get(form);
};

const getFormState = (id: string): FormState | undefined => {
	return formStore.getStore()?.state.get(id);
};

/**
 * returns the current request context from within a form handler
 * @returns the hono context object
 * @throws if called outside of a form handler context
 */
export const getRequestContext = (): Context => {
	const store = formHandlerStore.getStore();
	if (!store) {
		throw new Error('getRequestContext called outside of form handler');
	}

	return store.context;
};
// #endregion

// #region form factory
/**
 * creates a form definition with schema validation and handler
 * @param schema standard schema for input validation
 * @param handler async function to process validated form data
 * @returns form definition object
 */
export const form = <TInput extends Record<string, unknown>, TOutput>(
	schema: StandardSchemaV1<TInput>,
	handler: (data: TInput, issue: IssueBuilder<TInput>) => Promise<TOutput>,
): FormDefinition<TInput, TOutput> => {
	const definition = {} as FormDefinition<TInput, TOutput>;

	const getConfig = () => {
		const config = getFormConfig(definition);
		if (!config) {
			throw new Error('Form accessed outside of registered context');
		}
		return config;
	};

	// enumerable - included in spread
	Object.defineProperties(definition, {
		action: {
			enumerable: true,
			get: () => getConfig().action,
		},
		method: {
			enumerable: true,
			value: 'post',
		},
	});

	// non-enumerable - excluded from spread
	Object.defineProperties(definition, {
		fields: {
			enumerable: false,
			get: () => {
				const state = getFormState(getConfig().id);
				return createFieldsProxy<TInput>(
					() => state?.input ?? {},
					() => state?.issues ?? {},
				);
			},
		},
		result: {
			enumerable: false,
			get: () => {
				const config = getFormConfig(definition);
				if (!config) {
					return undefined;
				}
				return getFormState(config.id)?.result as TOutput | undefined;
			},
		},
		__: {
			enumerable: false,
			value: { schema, handler },
		},
	});

	return definition;
};
// #endregion

// #region middleware
const EMPTY_STATE = new Map<string, FormState>();

/**
 * registers form handlers as middleware
 * @param forms object mapping form IDs to form definitions
 * @returns hono middleware handler
 */
export const registerForms = (forms: Record<string, FormDefinition<any, any>>): MiddlewareHandler => {
	const definitions = new WeakMap<FormDefinition<any, any>, FormConfig>();
	for (const [id, form] of Object.entries(forms)) {
		definitions.set(form, { id, action: `?__action=${id}` });
	}

	return async (c: Context, next: Next) => {
		let state: Map<string, FormState> | undefined;

		jmp: {
			if (c.req.method !== 'POST') {
				break jmp;
			}

			const actionId = c.req.query('__action');
			if (actionId === undefined) {
				break jmp;
			}

			const form = forms[actionId];
			if (form === undefined) {
				break jmp;
			}

			const fetchSite = c.req.header('sec-fetch-site');
			if (fetchSite !== 'same-origin') {
				throw new HTTPException(403, { message: 'cross-origin form submission rejected' });
			}

			const formData = await c.req.formData();
			const input = convertFormData(formData);

			// validate with schema
			const validated = await form.__.schema['~standard'].validate(input);

			state ??= new Map();

			if (validated.issues) {
				state.set(actionId, {
					input,
					issues: flattenIssues(normalizeIssues(validated.issues)),
				});

				break jmp;
			}

			const issueBuilder = createIssueBuilder<any>();

			try {
				const result = await formHandlerStore.run({ context: c }, async () => {
					return await form.__.handler(validated.value, issueBuilder);
				});

				state.set(actionId, { input, issues: {}, result });
			} catch (err) {
				if (err instanceof ValidationError) {
					state.set(actionId, { input, issues: flattenIssues(err.issues) });
				} else {
					throw err;
				}
			}
		}

		await formStore.run({ definitions: definitions, state: state ?? EMPTY_STATE }, next);
	};
};
// #endregion

// #region validation error
/**
 * error thrown to indicate form validation failure
 */
export class ValidationError extends Error {
	readonly issues: FormIssue[];

	constructor(issues: FormIssue[]) {
		super('Validation failed');
		this.name = 'ValidationError';
		this.issues = issues;
	}
}

/**
 * throws a validation error with the given issues
 * @param issues one or more form issues
 */
export const invalid: {
	(...issues: (FormIssue | string)[]): never;
} = (...issues: (FormIssue | string)[]): never => {
	throw new ValidationError(
		issues.map((issue) => (typeof issue === 'string' ? { path: [], message: issue } : issue)),
	);
};
// #endregion

// #region redirect
type RedirectStatus = 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308;

/**
 * throws an HTTP redirect exception
 * @param status redirect status code
 * @param location target URL
 */
export const redirect: {
	(status: RedirectStatus, location: string): never;
} = (status: RedirectStatus, location: string): never => {
	throw new HTTPException(status as ContentfulStatusCode, {
		res: new Response(null, { status, headers: { location } }),
	});
};
// #endregion

// #region issue builder
const createIssueBuilder = <T>(): IssueBuilder<T> => {
	const createProxy = (path: (string | number)[]): any => {
		const issueFunc = (message: string): FormIssue => ({ path, message });

		return new Proxy(issueFunc, {
			get(_, prop) {
				if (typeof prop === 'symbol') {
					return undefined;
				}

				const key = /^\d+$/.test(prop) ? parseInt(prop, 10) : prop;
				return createProxy([...path, key]);
			},
		});
	};

	return createProxy([]);
};
// #endregion

// #region fields proxy
const createFieldsProxy = <T>(
	getInput: () => Record<string, unknown>,
	getIssues: () => Record<string, FormIssue[]>,
	path: (string | number)[] = [],
): FieldsProxy<T> => {
	const getValue = (): unknown => {
		let current: unknown = getInput();
		for (const key of path) {
			if (current == null || typeof current !== 'object') {
				return undefined;
			}
			current = (current as Record<string | number, unknown>)[key];
		}
		return current;
	};

	const buildName = (): string => {
		let name = '';
		for (const segment of path) {
			if (typeof segment === 'number') {
				name += `[${segment}]`;
			} else {
				name += name === '' ? segment : `.${segment}`;
			}
		}
		return name;
	};

	const pathKey = buildName() || '$';

	const accessor: FieldAccessor = {
		value: getValue,
		issues: () => {
			const issues = getIssues()[pathKey] ?? [];
			const pathStr = path.join('.');
			return issues
				.filter((issue) => issue.path.join('.') === pathStr)
				.map((issue) => ({ path: issue.path, message: issue.message }));
		},
		allIssues: () => {
			const issues = getIssues()[pathKey] ?? [];
			return issues.map((issue) => ({ path: issue.path, message: issue.message }));
		},
		as: (type, inputValue) => {
			const baseName = buildName();
			const issues = getIssues()[pathKey] ?? [];
			const pathStr = path.join('.');
			const hasError = issues.some((i) => i.path.join('.') === pathStr);

			const isArray =
				type === 'file multiple' ||
				type === 'select multiple' ||
				(type === 'checkbox' && typeof inputValue === 'string');

			const prefix =
				type === 'number' || type === 'range' ? 'n:' : type === 'checkbox' && !isArray ? 'b:' : '';

			const props: Record<string, unknown> = {
				name: prefix + baseName + (isArray ? '[]' : ''),
				'aria-invalid': hasError ? 'true' : undefined,
			};

			// add type attribute for non-text, non-select elements
			if (type !== 'text' && type !== 'select' && type !== 'select multiple') {
				props.type = type === 'file multiple' ? 'file' : type;
			}

			// submit and hidden require inputValue
			if (type === 'submit' || type === 'hidden') {
				props.value = inputValue;
				return props;
			}

			// select inputs
			if (type === 'select' || type === 'select multiple') {
				props.multiple = isArray;
				props.value = getValue();
				return props;
			}

			// checkbox and radio inputs
			if (type === 'checkbox' || type === 'radio') {
				props.value = inputValue ?? 'on';
				const value = getValue();

				if (type === 'radio') {
					props.checked = value === inputValue;
				} else if (isArray) {
					props.checked = Array.isArray(value) && value.includes(inputValue);
				} else {
					props.checked = !!value;
				}

				return props;
			}

			// file inputs
			if (type === 'file' || type === 'file multiple') {
				props.multiple = isArray;
				return props;
			}

			// all other text-like inputs
			const value = getValue();
			props.value = value != null ? String(value) : '';
			return props;
		},
	};

	return new Proxy(accessor as FieldsProxy<T>, {
		get(_, prop) {
			if (typeof prop === 'symbol') {
				return undefined;
			}

			// return accessor methods
			if (prop === 'value' || prop === 'issues' || prop === 'allIssues' || prop === 'as') {
				return accessor[prop];
			}

			// nested field access
			const key = /^\d+$/.test(prop) ? parseInt(prop, 10) : prop;
			return createFieldsProxy(getInput, getIssues, [...path, key]);
		},
	});
};
// #endregion

// #region form data conversion
const convertFormData = (data: FormData): Record<string, unknown> => {
	const result: Record<string, unknown> = {};

	for (let key of data.keys()) {
		const isArray = key.endsWith('[]');
		let values: unknown[] = data.getAll(key);

		if (isArray) {
			key = key.slice(0, -2);
		}

		// reject duplicate non-array keys
		if (values.length > 1 && !isArray) {
			throw new Error(`Form cannot contain duplicated keys — "${key}" has ${values.length} values`);
		}

		// filter empty file inputs (browsers submit a File with empty name for empty file inputs)
		values = values.filter(
			(entry) =>
				typeof entry === 'string' || (entry instanceof File && (entry.name !== '' || entry.size > 0)),
		);

		// handle type coercion prefixes
		if (key.startsWith('n:')) {
			key = key.slice(2);
			values = values.map((v) => (v === '' ? undefined : parseFloat(v as string)));
		} else if (key.startsWith('b:')) {
			key = key.slice(2);
			values = values.map((v) => v === 'on');
		}

		setNestedValue(result, key, isArray ? values : values[0]);
	}

	return result;
};

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const setNestedValue = (obj: Record<string, unknown>, path: string, value: unknown): void => {
	const keys = path.split(/\.|\[|\]/).filter((k): k is string => k !== '');

	if (keys.length === 0) {
		return;
	}

	let current = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i]!;

		if (DANGEROUS_KEYS.has(key)) {
			throw new Error(`Invalid key "${key}"`);
		}

		const nextKey = keys[i + 1]!;
		const isNextArray = /^\d+$/.test(nextKey);
		const exists = key in current;
		const inner = current[key];

		if (exists && isNextArray !== Array.isArray(inner)) {
			throw new Error(`Invalid array key "${nextKey}"`);
		}

		if (!exists) {
			current[key] = isNextArray ? [] : {};
		}

		current = current[key] as Record<string, unknown>;
	}

	const finalKey = keys[keys.length - 1]!;

	if (DANGEROUS_KEYS.has(finalKey)) {
		throw new Error(`Invalid key "${finalKey}"`);
	}

	current[finalKey] = value;
};

const normalizeIssues = (issues: readonly StandardSchemaV1.Issue[]): FormIssue[] => {
	return issues.map((issue) => ({
		path: (issue.path ?? []).map((segment) => (typeof segment === 'object' ? segment.key : segment)) as (
			| string
			| number
		)[],
		message: issue.message,
	}));
};

/** flattens issues into a map keyed by path prefix for O(1) lookups */
const flattenIssues = (issues: FormIssue[]): Record<string, FormIssue[]> => {
	const result: Record<string, FormIssue[]> = {};

	for (const issue of issues) {
		(result.$ ??= []).push(issue);

		let name = '';
		for (const key of issue.path) {
			if (typeof key === 'number') {
				name += `[${key}]`;
			} else {
				name += name === '' ? key : `.${key}`;
			}
			(result[name] ??= []).push(issue);
		}
	}

	return result;
};
// #endregion
