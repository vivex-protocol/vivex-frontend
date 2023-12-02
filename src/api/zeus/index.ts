/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "https://api.thegraph.com/subgraphs/name/contango-xyz/v2-optimism"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : never, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	BigDecimal?: ScalarResolver;
	BigInt?: ScalarResolver;
	Bytes?: ScalarResolver;
	Int8?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    ["Account"]: AliasType<{
	id?:boolean | `@${string}`,
positions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Position_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>},ValueTypes["Position"]],
orders?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Order_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>},ValueTypes["Order"]],
referralCounters?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ReferralCounter_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["ReferralCounter_filter"] | undefined | null | Variable<any, string>},ValueTypes["ReferralCounter"]],
	referralCode?:boolean | `@${string}`,
	referredByCode?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Account_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	positions_?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,
	orders_?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>,
	referralCounters_?: ValueTypes["ReferralCounter_filter"] | undefined | null | Variable<any, string>,
	referralCode?: string | undefined | null | Variable<any, string>,
	referralCode_not?: string | undefined | null | Variable<any, string>,
	referralCode_gt?: string | undefined | null | Variable<any, string>,
	referralCode_lt?: string | undefined | null | Variable<any, string>,
	referralCode_gte?: string | undefined | null | Variable<any, string>,
	referralCode_lte?: string | undefined | null | Variable<any, string>,
	referralCode_in?: Array<string> | undefined | null | Variable<any, string>,
	referralCode_not_in?: Array<string> | undefined | null | Variable<any, string>,
	referralCode_contains?: string | undefined | null | Variable<any, string>,
	referralCode_contains_nocase?: string | undefined | null | Variable<any, string>,
	referralCode_not_contains?: string | undefined | null | Variable<any, string>,
	referralCode_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	referralCode_starts_with?: string | undefined | null | Variable<any, string>,
	referralCode_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	referralCode_not_starts_with?: string | undefined | null | Variable<any, string>,
	referralCode_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	referralCode_ends_with?: string | undefined | null | Variable<any, string>,
	referralCode_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	referralCode_not_ends_with?: string | undefined | null | Variable<any, string>,
	referralCode_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode?: string | undefined | null | Variable<any, string>,
	referredByCode_not?: string | undefined | null | Variable<any, string>,
	referredByCode_gt?: string | undefined | null | Variable<any, string>,
	referredByCode_lt?: string | undefined | null | Variable<any, string>,
	referredByCode_gte?: string | undefined | null | Variable<any, string>,
	referredByCode_lte?: string | undefined | null | Variable<any, string>,
	referredByCode_in?: Array<string> | undefined | null | Variable<any, string>,
	referredByCode_not_in?: Array<string> | undefined | null | Variable<any, string>,
	referredByCode_contains?: string | undefined | null | Variable<any, string>,
	referredByCode_contains_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode_not_contains?: string | undefined | null | Variable<any, string>,
	referredByCode_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode_starts_with?: string | undefined | null | Variable<any, string>,
	referredByCode_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode_not_starts_with?: string | undefined | null | Variable<any, string>,
	referredByCode_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode_ends_with?: string | undefined | null | Variable<any, string>,
	referredByCode_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	referredByCode_not_ends_with?: string | undefined | null | Variable<any, string>,
	referredByCode_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["Account_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["Account_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Account_orderBy"]:Account_orderBy;
	["Asset"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	decimals?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AssetTotal"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	openInterest?:boolean | `@${string}`,
	totalVolume?:boolean | `@${string}`,
	totalFees?:boolean | `@${string}`,
	openPositions?:boolean | `@${string}`,
	totalPositions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AssetTotal_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol?: string | undefined | null | Variable<any, string>,
	symbol_not?: string | undefined | null | Variable<any, string>,
	symbol_gt?: string | undefined | null | Variable<any, string>,
	symbol_lt?: string | undefined | null | Variable<any, string>,
	symbol_gte?: string | undefined | null | Variable<any, string>,
	symbol_lte?: string | undefined | null | Variable<any, string>,
	symbol_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_contains?: string | undefined | null | Variable<any, string>,
	symbol_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_contains?: string | undefined | null | Variable<any, string>,
	symbol_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	openInterest?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openInterest_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalVolume?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalVolume_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalFees?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalFees_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openPositions?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	openPositions_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	totalPositions?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	totalPositions_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["AssetTotal_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["AssetTotal_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["AssetTotal_orderBy"]:AssetTotal_orderBy;
	["Asset_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	name_not?: string | undefined | null | Variable<any, string>,
	name_gt?: string | undefined | null | Variable<any, string>,
	name_lt?: string | undefined | null | Variable<any, string>,
	name_gte?: string | undefined | null | Variable<any, string>,
	name_lte?: string | undefined | null | Variable<any, string>,
	name_in?: Array<string> | undefined | null | Variable<any, string>,
	name_not_in?: Array<string> | undefined | null | Variable<any, string>,
	name_contains?: string | undefined | null | Variable<any, string>,
	name_contains_nocase?: string | undefined | null | Variable<any, string>,
	name_not_contains?: string | undefined | null | Variable<any, string>,
	name_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	name_starts_with?: string | undefined | null | Variable<any, string>,
	name_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	name_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	name_ends_with?: string | undefined | null | Variable<any, string>,
	name_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	name_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol?: string | undefined | null | Variable<any, string>,
	symbol_not?: string | undefined | null | Variable<any, string>,
	symbol_gt?: string | undefined | null | Variable<any, string>,
	symbol_lt?: string | undefined | null | Variable<any, string>,
	symbol_gte?: string | undefined | null | Variable<any, string>,
	symbol_lte?: string | undefined | null | Variable<any, string>,
	symbol_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_contains?: string | undefined | null | Variable<any, string>,
	symbol_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_contains?: string | undefined | null | Variable<any, string>,
	symbol_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	decimals?: number | undefined | null | Variable<any, string>,
	decimals_not?: number | undefined | null | Variable<any, string>,
	decimals_gt?: number | undefined | null | Variable<any, string>,
	decimals_lt?: number | undefined | null | Variable<any, string>,
	decimals_gte?: number | undefined | null | Variable<any, string>,
	decimals_lte?: number | undefined | null | Variable<any, string>,
	decimals_in?: Array<number> | undefined | null | Variable<any, string>,
	decimals_not_in?: Array<number> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["Asset_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["Asset_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Asset_orderBy"]:Asset_orderBy;
	["BigDecimal"]:unknown;
	["BigInt"]:unknown;
	["BlockChangedFilter"]: {
	number_gte: number | Variable<any, string>
};
	["Block_height"]: {
	hash?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	number?: number | undefined | null | Variable<any, string>,
	number_gte?: number | undefined | null | Variable<any, string>
};
	["Bytes"]:unknown;
	["Currency"]:Currency;
	["HistoryItem"]: AliasType<{
	id?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	position?:ValueTypes["Position"],
	fillSize?:boolean | `@${string}`,
	fillCost?:boolean | `@${string}`,
	fillPrice?:boolean | `@${string}`,
	cashflowCcy?:boolean | `@${string}`,
	cashflowBase?:boolean | `@${string}`,
	cashflowQuote?:boolean | `@${string}`,
	equityBase?:boolean | `@${string}`,
	equityQuote?:boolean | `@${string}`,
	previousOpenQuantity?:boolean | `@${string}`,
	openQuantity?:boolean | `@${string}`,
	previousOpenCost?:boolean | `@${string}`,
	openCost?:boolean | `@${string}`,
	closedCost?:boolean | `@${string}`,
	cashflowBaseAcc?:boolean | `@${string}`,
	cashflowQuoteAcc?:boolean | `@${string}`,
	equityBaseAcc?:boolean | `@${string}`,
	equityQuoteAcc?:boolean | `@${string}`,
	feeCcy?:boolean | `@${string}`,
	feeBase?:boolean | `@${string}`,
	feeQuote?:boolean | `@${string}`,
	feeBaseAcc?:boolean | `@${string}`,
	feeQuoteAcc?:boolean | `@${string}`,
	realisedPnLBase?:boolean | `@${string}`,
	realisedPnLQuote?:boolean | `@${string}`,
	spotPrice?:boolean | `@${string}`,
	owner?:ValueTypes["Account"],
	tradedBy?:ValueTypes["Account"],
	blockNumber?:boolean | `@${string}`,
	blockTimestamp?:boolean | `@${string}`,
	transactionHash?:boolean | `@${string}`,
	prevTransactionHash?:boolean | `@${string}`,
	dateTime?:boolean | `@${string}`,
	executionFeeBase?:boolean | `@${string}`,
	executionFeeQuote?:boolean | `@${string}`,
	liquidationPenalty?:boolean | `@${string}`,
	liquidationPenaltyBase?:boolean | `@${string}`,
	liquidationPenaltyQuote?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["HistoryItemType"]:HistoryItemType;
	["HistoryItem_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	type?: ValueTypes["HistoryItemType"] | undefined | null | Variable<any, string>,
	type_not?: ValueTypes["HistoryItemType"] | undefined | null | Variable<any, string>,
	type_in?: Array<ValueTypes["HistoryItemType"]> | undefined | null | Variable<any, string>,
	type_not_in?: Array<ValueTypes["HistoryItemType"]> | undefined | null | Variable<any, string>,
	position?: string | undefined | null | Variable<any, string>,
	position_not?: string | undefined | null | Variable<any, string>,
	position_gt?: string | undefined | null | Variable<any, string>,
	position_lt?: string | undefined | null | Variable<any, string>,
	position_gte?: string | undefined | null | Variable<any, string>,
	position_lte?: string | undefined | null | Variable<any, string>,
	position_in?: Array<string> | undefined | null | Variable<any, string>,
	position_not_in?: Array<string> | undefined | null | Variable<any, string>,
	position_contains?: string | undefined | null | Variable<any, string>,
	position_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_not_contains?: string | undefined | null | Variable<any, string>,
	position_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_starts_with?: string | undefined | null | Variable<any, string>,
	position_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_starts_with?: string | undefined | null | Variable<any, string>,
	position_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_ends_with?: string | undefined | null | Variable<any, string>,
	position_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_ends_with?: string | undefined | null | Variable<any, string>,
	position_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,
	fillSize?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillSize_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	fillSize_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	fillCost?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillCost_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	fillCost_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	fillPrice?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	fillPrice_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	fillPrice_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowCcy?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	cashflowCcy_not?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	cashflowCcy_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	cashflowCcy_not_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	cashflowBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	previousOpenQuantity?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenQuantity_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	previousOpenQuantity_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openQuantity?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openQuantity_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openQuantity_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	previousOpenCost?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	previousOpenCost_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	previousOpenCost_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openCost?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openCost_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	closedCost?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	closedCost_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	closedCost_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowBaseAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBaseAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowBaseAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuoteAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuoteAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBaseAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBaseAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBaseAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuoteAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuoteAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuoteAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeCcy?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	feeCcy_not?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	feeCcy_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	feeCcy_not_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	feeBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeBaseAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeBaseAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeBaseAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeQuoteAcc?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feeQuoteAcc_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feeQuoteAcc_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	spotPrice?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	spotPrice_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	spotPrice_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	owner?: string | undefined | null | Variable<any, string>,
	owner_not?: string | undefined | null | Variable<any, string>,
	owner_gt?: string | undefined | null | Variable<any, string>,
	owner_lt?: string | undefined | null | Variable<any, string>,
	owner_gte?: string | undefined | null | Variable<any, string>,
	owner_lte?: string | undefined | null | Variable<any, string>,
	owner_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_not_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_contains?: string | undefined | null | Variable<any, string>,
	owner_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_contains?: string | undefined | null | Variable<any, string>,
	owner_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_starts_with?: string | undefined | null | Variable<any, string>,
	owner_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_ends_with?: string | undefined | null | Variable<any, string>,
	owner_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	tradedBy?: string | undefined | null | Variable<any, string>,
	tradedBy_not?: string | undefined | null | Variable<any, string>,
	tradedBy_gt?: string | undefined | null | Variable<any, string>,
	tradedBy_lt?: string | undefined | null | Variable<any, string>,
	tradedBy_gte?: string | undefined | null | Variable<any, string>,
	tradedBy_lte?: string | undefined | null | Variable<any, string>,
	tradedBy_in?: Array<string> | undefined | null | Variable<any, string>,
	tradedBy_not_in?: Array<string> | undefined | null | Variable<any, string>,
	tradedBy_contains?: string | undefined | null | Variable<any, string>,
	tradedBy_contains_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_not_contains?: string | undefined | null | Variable<any, string>,
	tradedBy_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_starts_with?: string | undefined | null | Variable<any, string>,
	tradedBy_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_not_starts_with?: string | undefined | null | Variable<any, string>,
	tradedBy_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_ends_with?: string | undefined | null | Variable<any, string>,
	tradedBy_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_not_ends_with?: string | undefined | null | Variable<any, string>,
	tradedBy_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	tradedBy_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	blockNumber?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockNumber_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockTimestamp?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockTimestamp_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	transactionHash?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_not?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_gt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_lt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_gte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_lte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	transactionHash_not_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	transactionHash_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	transactionHash_not_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_not?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_gt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_lt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_gte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_lte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	prevTransactionHash_not_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	prevTransactionHash_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	prevTransactionHash_not_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	dateTime?: string | undefined | null | Variable<any, string>,
	dateTime_not?: string | undefined | null | Variable<any, string>,
	dateTime_gt?: string | undefined | null | Variable<any, string>,
	dateTime_lt?: string | undefined | null | Variable<any, string>,
	dateTime_gte?: string | undefined | null | Variable<any, string>,
	dateTime_lte?: string | undefined | null | Variable<any, string>,
	dateTime_in?: Array<string> | undefined | null | Variable<any, string>,
	dateTime_not_in?: Array<string> | undefined | null | Variable<any, string>,
	dateTime_contains?: string | undefined | null | Variable<any, string>,
	dateTime_contains_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_contains?: string | undefined | null | Variable<any, string>,
	dateTime_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_starts_with?: string | undefined | null | Variable<any, string>,
	dateTime_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_starts_with?: string | undefined | null | Variable<any, string>,
	dateTime_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_ends_with?: string | undefined | null | Variable<any, string>,
	dateTime_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_ends_with?: string | undefined | null | Variable<any, string>,
	dateTime_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	executionFeeBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	executionFeeBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	executionFeeQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	executionFeeQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	executionFeeQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenalty?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenalty_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenalty_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenaltyBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenaltyBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	liquidationPenaltyQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["HistoryItem_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["HistoryItem_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["HistoryItem_orderBy"]:HistoryItem_orderBy;
	["Instrument"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	base?:ValueTypes["Asset"],
	quote?:ValueTypes["Asset"],
positions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Position_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>},ValueTypes["Position"]],
orders?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Order_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>},ValueTypes["Order"]],
		__typename?: boolean | `@${string}`
}>;
	["InstrumentTotal"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	openInterest?:boolean | `@${string}`,
	totalVolume?:boolean | `@${string}`,
	totalFees?:boolean | `@${string}`,
	openPositions?:boolean | `@${string}`,
	totalPositions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["InstrumentTotal_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol?: string | undefined | null | Variable<any, string>,
	symbol_not?: string | undefined | null | Variable<any, string>,
	symbol_gt?: string | undefined | null | Variable<any, string>,
	symbol_lt?: string | undefined | null | Variable<any, string>,
	symbol_gte?: string | undefined | null | Variable<any, string>,
	symbol_lte?: string | undefined | null | Variable<any, string>,
	symbol_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_contains?: string | undefined | null | Variable<any, string>,
	symbol_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_contains?: string | undefined | null | Variable<any, string>,
	symbol_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	openInterest?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openInterest_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openInterest_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalVolume?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalVolume_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalVolume_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalFees?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	totalFees_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	totalFees_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openPositions?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	openPositions_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	openPositions_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	totalPositions?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	totalPositions_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	totalPositions_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["InstrumentTotal_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["InstrumentTotal_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["InstrumentTotal_orderBy"]:InstrumentTotal_orderBy;
	["Instrument_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol?: string | undefined | null | Variable<any, string>,
	symbol_not?: string | undefined | null | Variable<any, string>,
	symbol_gt?: string | undefined | null | Variable<any, string>,
	symbol_lt?: string | undefined | null | Variable<any, string>,
	symbol_gte?: string | undefined | null | Variable<any, string>,
	symbol_lte?: string | undefined | null | Variable<any, string>,
	symbol_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_not_in?: Array<string> | undefined | null | Variable<any, string>,
	symbol_contains?: string | undefined | null | Variable<any, string>,
	symbol_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_contains?: string | undefined | null | Variable<any, string>,
	symbol_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	symbol_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with?: string | undefined | null | Variable<any, string>,
	symbol_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with?: string | undefined | null | Variable<any, string>,
	symbol_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	base?: string | undefined | null | Variable<any, string>,
	base_not?: string | undefined | null | Variable<any, string>,
	base_gt?: string | undefined | null | Variable<any, string>,
	base_lt?: string | undefined | null | Variable<any, string>,
	base_gte?: string | undefined | null | Variable<any, string>,
	base_lte?: string | undefined | null | Variable<any, string>,
	base_in?: Array<string> | undefined | null | Variable<any, string>,
	base_not_in?: Array<string> | undefined | null | Variable<any, string>,
	base_contains?: string | undefined | null | Variable<any, string>,
	base_contains_nocase?: string | undefined | null | Variable<any, string>,
	base_not_contains?: string | undefined | null | Variable<any, string>,
	base_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	base_starts_with?: string | undefined | null | Variable<any, string>,
	base_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	base_not_starts_with?: string | undefined | null | Variable<any, string>,
	base_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	base_ends_with?: string | undefined | null | Variable<any, string>,
	base_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	base_not_ends_with?: string | undefined | null | Variable<any, string>,
	base_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	base_?: ValueTypes["Asset_filter"] | undefined | null | Variable<any, string>,
	quote?: string | undefined | null | Variable<any, string>,
	quote_not?: string | undefined | null | Variable<any, string>,
	quote_gt?: string | undefined | null | Variable<any, string>,
	quote_lt?: string | undefined | null | Variable<any, string>,
	quote_gte?: string | undefined | null | Variable<any, string>,
	quote_lte?: string | undefined | null | Variable<any, string>,
	quote_in?: Array<string> | undefined | null | Variable<any, string>,
	quote_not_in?: Array<string> | undefined | null | Variable<any, string>,
	quote_contains?: string | undefined | null | Variable<any, string>,
	quote_contains_nocase?: string | undefined | null | Variable<any, string>,
	quote_not_contains?: string | undefined | null | Variable<any, string>,
	quote_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	quote_starts_with?: string | undefined | null | Variable<any, string>,
	quote_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	quote_not_starts_with?: string | undefined | null | Variable<any, string>,
	quote_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	quote_ends_with?: string | undefined | null | Variable<any, string>,
	quote_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	quote_not_ends_with?: string | undefined | null | Variable<any, string>,
	quote_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	quote_?: ValueTypes["Asset_filter"] | undefined | null | Variable<any, string>,
	positions_?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,
	orders_?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["Instrument_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["Instrument_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Instrument_orderBy"]:Instrument_orderBy;
	/** 8 bytes signed integer */
["Int8"]:unknown;
	["MoneyMarket"]:MoneyMarket;
	["Order"]: AliasType<{
	id?:boolean | `@${string}`,
	position?:ValueTypes["Position"],
	instrument?:ValueTypes["Instrument"],
	owner?:ValueTypes["Account"],
	side?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	quantity?:boolean | `@${string}`,
	limitPrice?:boolean | `@${string}`,
	tolerance?:boolean | `@${string}`,
	cashflow?:boolean | `@${string}`,
	cashflowCcy?:boolean | `@${string}`,
	deadline?:boolean | `@${string}`,
	placedBy?:ValueTypes["Account"],
	blockNumber?:boolean | `@${string}`,
	blockTimestamp?:boolean | `@${string}`,
	dateTime?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Defines the order direction, either ascending or descending */
["OrderDirection"]:OrderDirection;
	["OrderType"]:OrderType;
	["Order_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	position?: string | undefined | null | Variable<any, string>,
	position_not?: string | undefined | null | Variable<any, string>,
	position_gt?: string | undefined | null | Variable<any, string>,
	position_lt?: string | undefined | null | Variable<any, string>,
	position_gte?: string | undefined | null | Variable<any, string>,
	position_lte?: string | undefined | null | Variable<any, string>,
	position_in?: Array<string> | undefined | null | Variable<any, string>,
	position_not_in?: Array<string> | undefined | null | Variable<any, string>,
	position_contains?: string | undefined | null | Variable<any, string>,
	position_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_not_contains?: string | undefined | null | Variable<any, string>,
	position_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_starts_with?: string | undefined | null | Variable<any, string>,
	position_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_starts_with?: string | undefined | null | Variable<any, string>,
	position_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_ends_with?: string | undefined | null | Variable<any, string>,
	position_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_ends_with?: string | undefined | null | Variable<any, string>,
	position_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,
	instrument?: string | undefined | null | Variable<any, string>,
	instrument_not?: string | undefined | null | Variable<any, string>,
	instrument_gt?: string | undefined | null | Variable<any, string>,
	instrument_lt?: string | undefined | null | Variable<any, string>,
	instrument_gte?: string | undefined | null | Variable<any, string>,
	instrument_lte?: string | undefined | null | Variable<any, string>,
	instrument_in?: Array<string> | undefined | null | Variable<any, string>,
	instrument_not_in?: Array<string> | undefined | null | Variable<any, string>,
	instrument_contains?: string | undefined | null | Variable<any, string>,
	instrument_contains_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_contains?: string | undefined | null | Variable<any, string>,
	instrument_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	instrument_starts_with?: string | undefined | null | Variable<any, string>,
	instrument_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_starts_with?: string | undefined | null | Variable<any, string>,
	instrument_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_ends_with?: string | undefined | null | Variable<any, string>,
	instrument_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_ends_with?: string | undefined | null | Variable<any, string>,
	instrument_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_?: ValueTypes["Instrument_filter"] | undefined | null | Variable<any, string>,
	owner?: string | undefined | null | Variable<any, string>,
	owner_not?: string | undefined | null | Variable<any, string>,
	owner_gt?: string | undefined | null | Variable<any, string>,
	owner_lt?: string | undefined | null | Variable<any, string>,
	owner_gte?: string | undefined | null | Variable<any, string>,
	owner_lte?: string | undefined | null | Variable<any, string>,
	owner_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_not_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_contains?: string | undefined | null | Variable<any, string>,
	owner_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_contains?: string | undefined | null | Variable<any, string>,
	owner_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_starts_with?: string | undefined | null | Variable<any, string>,
	owner_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_ends_with?: string | undefined | null | Variable<any, string>,
	owner_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	side?: ValueTypes["Side"] | undefined | null | Variable<any, string>,
	side_not?: ValueTypes["Side"] | undefined | null | Variable<any, string>,
	side_in?: Array<ValueTypes["Side"]> | undefined | null | Variable<any, string>,
	side_not_in?: Array<ValueTypes["Side"]> | undefined | null | Variable<any, string>,
	type?: ValueTypes["OrderType"] | undefined | null | Variable<any, string>,
	type_not?: ValueTypes["OrderType"] | undefined | null | Variable<any, string>,
	type_in?: Array<ValueTypes["OrderType"]> | undefined | null | Variable<any, string>,
	type_not_in?: Array<ValueTypes["OrderType"]> | undefined | null | Variable<any, string>,
	quantity?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	quantity_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	quantity_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	limitPrice?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	limitPrice_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	limitPrice_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	tolerance?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	tolerance_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	tolerance_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	cashflow?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	cashflow_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	cashflow_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	cashflowCcy?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	cashflowCcy_not?: ValueTypes["Currency"] | undefined | null | Variable<any, string>,
	cashflowCcy_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	cashflowCcy_not_in?: Array<ValueTypes["Currency"]> | undefined | null | Variable<any, string>,
	deadline?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	deadline_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	deadline_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	placedBy?: string | undefined | null | Variable<any, string>,
	placedBy_not?: string | undefined | null | Variable<any, string>,
	placedBy_gt?: string | undefined | null | Variable<any, string>,
	placedBy_lt?: string | undefined | null | Variable<any, string>,
	placedBy_gte?: string | undefined | null | Variable<any, string>,
	placedBy_lte?: string | undefined | null | Variable<any, string>,
	placedBy_in?: Array<string> | undefined | null | Variable<any, string>,
	placedBy_not_in?: Array<string> | undefined | null | Variable<any, string>,
	placedBy_contains?: string | undefined | null | Variable<any, string>,
	placedBy_contains_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_not_contains?: string | undefined | null | Variable<any, string>,
	placedBy_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_starts_with?: string | undefined | null | Variable<any, string>,
	placedBy_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_not_starts_with?: string | undefined | null | Variable<any, string>,
	placedBy_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_ends_with?: string | undefined | null | Variable<any, string>,
	placedBy_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_not_ends_with?: string | undefined | null | Variable<any, string>,
	placedBy_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	placedBy_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	blockNumber?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockNumber_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockNumber_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockTimestamp?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	blockTimestamp_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	blockTimestamp_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	dateTime?: string | undefined | null | Variable<any, string>,
	dateTime_not?: string | undefined | null | Variable<any, string>,
	dateTime_gt?: string | undefined | null | Variable<any, string>,
	dateTime_lt?: string | undefined | null | Variable<any, string>,
	dateTime_gte?: string | undefined | null | Variable<any, string>,
	dateTime_lte?: string | undefined | null | Variable<any, string>,
	dateTime_in?: Array<string> | undefined | null | Variable<any, string>,
	dateTime_not_in?: Array<string> | undefined | null | Variable<any, string>,
	dateTime_contains?: string | undefined | null | Variable<any, string>,
	dateTime_contains_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_contains?: string | undefined | null | Variable<any, string>,
	dateTime_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_starts_with?: string | undefined | null | Variable<any, string>,
	dateTime_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_starts_with?: string | undefined | null | Variable<any, string>,
	dateTime_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_ends_with?: string | undefined | null | Variable<any, string>,
	dateTime_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	dateTime_not_ends_with?: string | undefined | null | Variable<any, string>,
	dateTime_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["Order_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["Order_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Order_orderBy"]:Order_orderBy;
	["Position"]: AliasType<{
	id?:boolean | `@${string}`,
	instrument?:ValueTypes["Instrument"],
	owner?:ValueTypes["Account"],
	moneyMarket?:boolean | `@${string}`,
	number?:boolean | `@${string}`,
	expiry?:boolean | `@${string}`,
	quantity?:boolean | `@${string}`,
	openCost?:boolean | `@${string}`,
	feesBase?:boolean | `@${string}`,
	feesQuote?:boolean | `@${string}`,
	realisedPnLBase?:boolean | `@${string}`,
	realisedPnLQuote?:boolean | `@${string}`,
	cashflowBase?:boolean | `@${string}`,
	cashflowQuote?:boolean | `@${string}`,
	equityBase?:boolean | `@${string}`,
	equityQuote?:boolean | `@${string}`,
history?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["HistoryItem_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["HistoryItem_filter"] | undefined | null | Variable<any, string>},ValueTypes["HistoryItem"]],
orders?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Order_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>},ValueTypes["Order"]],
	latestTransactionHash?:boolean | `@${string}`,
	creationBlockNumber?:boolean | `@${string}`,
	creationBlockTimestamp?:boolean | `@${string}`,
	creationTransactionHash?:boolean | `@${string}`,
	creationDateTime?:boolean | `@${string}`,
	claimableRewards?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Position_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	instrument?: string | undefined | null | Variable<any, string>,
	instrument_not?: string | undefined | null | Variable<any, string>,
	instrument_gt?: string | undefined | null | Variable<any, string>,
	instrument_lt?: string | undefined | null | Variable<any, string>,
	instrument_gte?: string | undefined | null | Variable<any, string>,
	instrument_lte?: string | undefined | null | Variable<any, string>,
	instrument_in?: Array<string> | undefined | null | Variable<any, string>,
	instrument_not_in?: Array<string> | undefined | null | Variable<any, string>,
	instrument_contains?: string | undefined | null | Variable<any, string>,
	instrument_contains_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_contains?: string | undefined | null | Variable<any, string>,
	instrument_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	instrument_starts_with?: string | undefined | null | Variable<any, string>,
	instrument_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_starts_with?: string | undefined | null | Variable<any, string>,
	instrument_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_ends_with?: string | undefined | null | Variable<any, string>,
	instrument_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_not_ends_with?: string | undefined | null | Variable<any, string>,
	instrument_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	instrument_?: ValueTypes["Instrument_filter"] | undefined | null | Variable<any, string>,
	owner?: string | undefined | null | Variable<any, string>,
	owner_not?: string | undefined | null | Variable<any, string>,
	owner_gt?: string | undefined | null | Variable<any, string>,
	owner_lt?: string | undefined | null | Variable<any, string>,
	owner_gte?: string | undefined | null | Variable<any, string>,
	owner_lte?: string | undefined | null | Variable<any, string>,
	owner_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_not_in?: Array<string> | undefined | null | Variable<any, string>,
	owner_contains?: string | undefined | null | Variable<any, string>,
	owner_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_contains?: string | undefined | null | Variable<any, string>,
	owner_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	owner_starts_with?: string | undefined | null | Variable<any, string>,
	owner_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with?: string | undefined | null | Variable<any, string>,
	owner_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_ends_with?: string | undefined | null | Variable<any, string>,
	owner_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with?: string | undefined | null | Variable<any, string>,
	owner_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	owner_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	moneyMarket?: ValueTypes["MoneyMarket"] | undefined | null | Variable<any, string>,
	moneyMarket_not?: ValueTypes["MoneyMarket"] | undefined | null | Variable<any, string>,
	moneyMarket_in?: Array<ValueTypes["MoneyMarket"]> | undefined | null | Variable<any, string>,
	moneyMarket_not_in?: Array<ValueTypes["MoneyMarket"]> | undefined | null | Variable<any, string>,
	number?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	number_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	number_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	expiry?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	expiry_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	expiry_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	quantity?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	quantity_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	quantity_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openCost?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	openCost_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	openCost_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feesBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feesBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feesQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	feesQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	feesQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	realisedPnLQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	realisedPnLQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	cashflowQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	cashflowQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBase?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityBase_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityBase_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuote?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	equityQuote_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	equityQuote_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	history_?: ValueTypes["HistoryItem_filter"] | undefined | null | Variable<any, string>,
	orders_?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>,
	latestTransactionHash?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_not?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_gt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_lt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_gte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_lte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	latestTransactionHash_not_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	latestTransactionHash_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	latestTransactionHash_not_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationBlockNumber?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockNumber_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	creationBlockNumber_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	creationBlockTimestamp?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_not?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_gt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_lt?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_gte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_lte?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>,
	creationBlockTimestamp_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	creationBlockTimestamp_not_in?: Array<ValueTypes["BigInt"]> | undefined | null | Variable<any, string>,
	creationTransactionHash?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_not?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_gt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_lt?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_gte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_lte?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	creationTransactionHash_not_in?: Array<ValueTypes["Bytes"]> | undefined | null | Variable<any, string>,
	creationTransactionHash_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationTransactionHash_not_contains?: ValueTypes["Bytes"] | undefined | null | Variable<any, string>,
	creationDateTime?: string | undefined | null | Variable<any, string>,
	creationDateTime_not?: string | undefined | null | Variable<any, string>,
	creationDateTime_gt?: string | undefined | null | Variable<any, string>,
	creationDateTime_lt?: string | undefined | null | Variable<any, string>,
	creationDateTime_gte?: string | undefined | null | Variable<any, string>,
	creationDateTime_lte?: string | undefined | null | Variable<any, string>,
	creationDateTime_in?: Array<string> | undefined | null | Variable<any, string>,
	creationDateTime_not_in?: Array<string> | undefined | null | Variable<any, string>,
	creationDateTime_contains?: string | undefined | null | Variable<any, string>,
	creationDateTime_contains_nocase?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_contains?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	creationDateTime_starts_with?: string | undefined | null | Variable<any, string>,
	creationDateTime_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_starts_with?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	creationDateTime_ends_with?: string | undefined | null | Variable<any, string>,
	creationDateTime_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_ends_with?: string | undefined | null | Variable<any, string>,
	creationDateTime_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	claimableRewards?: boolean | undefined | null | Variable<any, string>,
	claimableRewards_not?: boolean | undefined | null | Variable<any, string>,
	claimableRewards_in?: Array<boolean> | undefined | null | Variable<any, string>,
	claimableRewards_not_in?: Array<boolean> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["Position_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["Position_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Position_orderBy"]:Position_orderBy;
	["Query"]: AliasType<{
asset?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Asset"]],
assets?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Asset_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Asset_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Asset"]],
assetTotal?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["AssetTotal"]],
assetTotals?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["AssetTotal_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["AssetTotal_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["AssetTotal"]],
instrument?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Instrument"]],
instruments?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Instrument_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Instrument_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Instrument"]],
instrumentTotal?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["InstrumentTotal"]],
instrumentTotals?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["InstrumentTotal_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["InstrumentTotal_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["InstrumentTotal"]],
underlyingPosition?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["UnderlyingPosition"]],
underlyingPositions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["UnderlyingPosition_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["UnderlyingPosition_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["UnderlyingPosition"]],
account?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Account"]],
accounts?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Account_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Account"]],
referralCounter?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["ReferralCounter"]],
referralCounters?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ReferralCounter_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["ReferralCounter_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["ReferralCounter"]],
position?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Position"]],
positions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Position_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Position"]],
historyItem?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["HistoryItem"]],
historyItems?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["HistoryItem_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["HistoryItem_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["HistoryItem"]],
order?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Order"]],
orders?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Order_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Order"]],
_meta?: [{	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>},ValueTypes["_Meta_"]],
		__typename?: boolean | `@${string}`
}>;
	["ReferralCounter"]: AliasType<{
	id?:boolean | `@${string}`,
	account?:ValueTypes["Account"],
	asset?:ValueTypes["Asset"],
	rebates?:boolean | `@${string}`,
	rewards?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReferralCounter_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	account?: string | undefined | null | Variable<any, string>,
	account_not?: string | undefined | null | Variable<any, string>,
	account_gt?: string | undefined | null | Variable<any, string>,
	account_lt?: string | undefined | null | Variable<any, string>,
	account_gte?: string | undefined | null | Variable<any, string>,
	account_lte?: string | undefined | null | Variable<any, string>,
	account_in?: Array<string> | undefined | null | Variable<any, string>,
	account_not_in?: Array<string> | undefined | null | Variable<any, string>,
	account_contains?: string | undefined | null | Variable<any, string>,
	account_contains_nocase?: string | undefined | null | Variable<any, string>,
	account_not_contains?: string | undefined | null | Variable<any, string>,
	account_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	account_starts_with?: string | undefined | null | Variable<any, string>,
	account_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	account_not_starts_with?: string | undefined | null | Variable<any, string>,
	account_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	account_ends_with?: string | undefined | null | Variable<any, string>,
	account_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	account_not_ends_with?: string | undefined | null | Variable<any, string>,
	account_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	account_?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,
	asset?: string | undefined | null | Variable<any, string>,
	asset_not?: string | undefined | null | Variable<any, string>,
	asset_gt?: string | undefined | null | Variable<any, string>,
	asset_lt?: string | undefined | null | Variable<any, string>,
	asset_gte?: string | undefined | null | Variable<any, string>,
	asset_lte?: string | undefined | null | Variable<any, string>,
	asset_in?: Array<string> | undefined | null | Variable<any, string>,
	asset_not_in?: Array<string> | undefined | null | Variable<any, string>,
	asset_contains?: string | undefined | null | Variable<any, string>,
	asset_contains_nocase?: string | undefined | null | Variable<any, string>,
	asset_not_contains?: string | undefined | null | Variable<any, string>,
	asset_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	asset_starts_with?: string | undefined | null | Variable<any, string>,
	asset_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	asset_not_starts_with?: string | undefined | null | Variable<any, string>,
	asset_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	asset_ends_with?: string | undefined | null | Variable<any, string>,
	asset_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	asset_not_ends_with?: string | undefined | null | Variable<any, string>,
	asset_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	asset_?: ValueTypes["Asset_filter"] | undefined | null | Variable<any, string>,
	rebates?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rebates_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	rebates_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	rewards?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_not?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_gt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_lt?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_gte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_lte?: ValueTypes["BigDecimal"] | undefined | null | Variable<any, string>,
	rewards_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	rewards_not_in?: Array<ValueTypes["BigDecimal"]> | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["ReferralCounter_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["ReferralCounter_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["ReferralCounter_orderBy"]:ReferralCounter_orderBy;
	["Side"]:Side;
	["Subscription"]: AliasType<{
asset?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Asset"]],
assets?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Asset_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Asset_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Asset"]],
assetTotal?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["AssetTotal"]],
assetTotals?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["AssetTotal_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["AssetTotal_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["AssetTotal"]],
instrument?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Instrument"]],
instruments?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Instrument_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Instrument_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Instrument"]],
instrumentTotal?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["InstrumentTotal"]],
instrumentTotals?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["InstrumentTotal_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["InstrumentTotal_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["InstrumentTotal"]],
underlyingPosition?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["UnderlyingPosition"]],
underlyingPositions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["UnderlyingPosition_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["UnderlyingPosition_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["UnderlyingPosition"]],
account?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Account"]],
accounts?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Account_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Account_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Account"]],
referralCounter?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["ReferralCounter"]],
referralCounters?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ReferralCounter_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["ReferralCounter_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["ReferralCounter"]],
position?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Position"]],
positions?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Position_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Position"]],
historyItem?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["HistoryItem"]],
historyItems?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["HistoryItem_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["HistoryItem_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["HistoryItem"]],
order?: [{	id: string | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Order"]],
orders?: [{	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["Order_orderBy"] | undefined | null | Variable<any, string>,	orderDirection?: ValueTypes["OrderDirection"] | undefined | null | Variable<any, string>,	where?: ValueTypes["Order_filter"] | undefined | null | Variable<any, string>,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ValueTypes["_SubgraphErrorPolicy_"] | Variable<any, string>},ValueTypes["Order"]],
_meta?: [{	block?: ValueTypes["Block_height"] | undefined | null | Variable<any, string>},ValueTypes["_Meta_"]],
		__typename?: boolean | `@${string}`
}>;
	["UnderlyingPosition"]: AliasType<{
	id?:boolean | `@${string}`,
	position?:ValueTypes["Position"],
		__typename?: boolean | `@${string}`
}>;
	["UnderlyingPosition_filter"]: {
	id?: string | undefined | null | Variable<any, string>,
	id_not?: string | undefined | null | Variable<any, string>,
	id_gt?: string | undefined | null | Variable<any, string>,
	id_lt?: string | undefined | null | Variable<any, string>,
	id_gte?: string | undefined | null | Variable<any, string>,
	id_lte?: string | undefined | null | Variable<any, string>,
	id_in?: Array<string> | undefined | null | Variable<any, string>,
	id_not_in?: Array<string> | undefined | null | Variable<any, string>,
	position?: string | undefined | null | Variable<any, string>,
	position_not?: string | undefined | null | Variable<any, string>,
	position_gt?: string | undefined | null | Variable<any, string>,
	position_lt?: string | undefined | null | Variable<any, string>,
	position_gte?: string | undefined | null | Variable<any, string>,
	position_lte?: string | undefined | null | Variable<any, string>,
	position_in?: Array<string> | undefined | null | Variable<any, string>,
	position_not_in?: Array<string> | undefined | null | Variable<any, string>,
	position_contains?: string | undefined | null | Variable<any, string>,
	position_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_not_contains?: string | undefined | null | Variable<any, string>,
	position_not_contains_nocase?: string | undefined | null | Variable<any, string>,
	position_starts_with?: string | undefined | null | Variable<any, string>,
	position_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_starts_with?: string | undefined | null | Variable<any, string>,
	position_not_starts_with_nocase?: string | undefined | null | Variable<any, string>,
	position_ends_with?: string | undefined | null | Variable<any, string>,
	position_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_not_ends_with?: string | undefined | null | Variable<any, string>,
	position_not_ends_with_nocase?: string | undefined | null | Variable<any, string>,
	position_?: ValueTypes["Position_filter"] | undefined | null | Variable<any, string>,
	/** Filter for the block changed event. */
	_change_block?: ValueTypes["BlockChangedFilter"] | undefined | null | Variable<any, string>,
	and?: Array<ValueTypes["UnderlyingPosition_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	or?: Array<ValueTypes["UnderlyingPosition_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["UnderlyingPosition_orderBy"]:UnderlyingPosition_orderBy;
	["_Block_"]: AliasType<{
	/** The hash of the block */
	hash?:boolean | `@${string}`,
	/** The block number */
	number?:boolean | `@${string}`,
	/** Integer representation of the timestamp stored in blocks for the chain */
	timestamp?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** The type for the top-level _meta field */
["_Meta_"]: AliasType<{
	/** Information about a specific subgraph block. The hash of the block
will be null if the _meta field has a block constraint that asks for
a block number. It will be filled if the _meta field has no block constraint
and therefore asks for the latest  block */
	block?:ValueTypes["_Block_"],
	/** The deployment ID */
	deployment?:boolean | `@${string}`,
	/** If `true`, the subgraph encountered indexing errors at some past block */
	hasIndexingErrors?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["_SubgraphErrorPolicy_"]:_SubgraphErrorPolicy_
  }

export type ResolverInputTypes = {
    ["Account"]: AliasType<{
	id?:boolean | `@${string}`,
positions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Position_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Position_filter"] | undefined | null},ResolverInputTypes["Position"]],
orders?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Order_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Order_filter"] | undefined | null},ResolverInputTypes["Order"]],
referralCounters?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["ReferralCounter_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["ReferralCounter_filter"] | undefined | null},ResolverInputTypes["ReferralCounter"]],
	referralCode?:boolean | `@${string}`,
	referredByCode?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Account_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	positions_?: ResolverInputTypes["Position_filter"] | undefined | null,
	orders_?: ResolverInputTypes["Order_filter"] | undefined | null,
	referralCounters_?: ResolverInputTypes["ReferralCounter_filter"] | undefined | null,
	referralCode?: string | undefined | null,
	referralCode_not?: string | undefined | null,
	referralCode_gt?: string | undefined | null,
	referralCode_lt?: string | undefined | null,
	referralCode_gte?: string | undefined | null,
	referralCode_lte?: string | undefined | null,
	referralCode_in?: Array<string> | undefined | null,
	referralCode_not_in?: Array<string> | undefined | null,
	referralCode_contains?: string | undefined | null,
	referralCode_contains_nocase?: string | undefined | null,
	referralCode_not_contains?: string | undefined | null,
	referralCode_not_contains_nocase?: string | undefined | null,
	referralCode_starts_with?: string | undefined | null,
	referralCode_starts_with_nocase?: string | undefined | null,
	referralCode_not_starts_with?: string | undefined | null,
	referralCode_not_starts_with_nocase?: string | undefined | null,
	referralCode_ends_with?: string | undefined | null,
	referralCode_ends_with_nocase?: string | undefined | null,
	referralCode_not_ends_with?: string | undefined | null,
	referralCode_not_ends_with_nocase?: string | undefined | null,
	referredByCode?: string | undefined | null,
	referredByCode_not?: string | undefined | null,
	referredByCode_gt?: string | undefined | null,
	referredByCode_lt?: string | undefined | null,
	referredByCode_gte?: string | undefined | null,
	referredByCode_lte?: string | undefined | null,
	referredByCode_in?: Array<string> | undefined | null,
	referredByCode_not_in?: Array<string> | undefined | null,
	referredByCode_contains?: string | undefined | null,
	referredByCode_contains_nocase?: string | undefined | null,
	referredByCode_not_contains?: string | undefined | null,
	referredByCode_not_contains_nocase?: string | undefined | null,
	referredByCode_starts_with?: string | undefined | null,
	referredByCode_starts_with_nocase?: string | undefined | null,
	referredByCode_not_starts_with?: string | undefined | null,
	referredByCode_not_starts_with_nocase?: string | undefined | null,
	referredByCode_ends_with?: string | undefined | null,
	referredByCode_ends_with_nocase?: string | undefined | null,
	referredByCode_not_ends_with?: string | undefined | null,
	referredByCode_not_ends_with_nocase?: string | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["Account_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["Account_filter"] | undefined | null> | undefined | null
};
	["Account_orderBy"]:Account_orderBy;
	["Asset"]: AliasType<{
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	decimals?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AssetTotal"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	openInterest?:boolean | `@${string}`,
	totalVolume?:boolean | `@${string}`,
	totalFees?:boolean | `@${string}`,
	openPositions?:boolean | `@${string}`,
	totalPositions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["AssetTotal_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	symbol?: string | undefined | null,
	symbol_not?: string | undefined | null,
	symbol_gt?: string | undefined | null,
	symbol_lt?: string | undefined | null,
	symbol_gte?: string | undefined | null,
	symbol_lte?: string | undefined | null,
	symbol_in?: Array<string> | undefined | null,
	symbol_not_in?: Array<string> | undefined | null,
	symbol_contains?: string | undefined | null,
	symbol_contains_nocase?: string | undefined | null,
	symbol_not_contains?: string | undefined | null,
	symbol_not_contains_nocase?: string | undefined | null,
	symbol_starts_with?: string | undefined | null,
	symbol_starts_with_nocase?: string | undefined | null,
	symbol_not_starts_with?: string | undefined | null,
	symbol_not_starts_with_nocase?: string | undefined | null,
	symbol_ends_with?: string | undefined | null,
	symbol_ends_with_nocase?: string | undefined | null,
	symbol_not_ends_with?: string | undefined | null,
	symbol_not_ends_with_nocase?: string | undefined | null,
	openInterest?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openInterest_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalVolume?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalVolume_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalFees?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalFees_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openPositions?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_not?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	openPositions_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	totalPositions?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_not?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	totalPositions_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["AssetTotal_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["AssetTotal_filter"] | undefined | null> | undefined | null
};
	["AssetTotal_orderBy"]:AssetTotal_orderBy;
	["Asset_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	name?: string | undefined | null,
	name_not?: string | undefined | null,
	name_gt?: string | undefined | null,
	name_lt?: string | undefined | null,
	name_gte?: string | undefined | null,
	name_lte?: string | undefined | null,
	name_in?: Array<string> | undefined | null,
	name_not_in?: Array<string> | undefined | null,
	name_contains?: string | undefined | null,
	name_contains_nocase?: string | undefined | null,
	name_not_contains?: string | undefined | null,
	name_not_contains_nocase?: string | undefined | null,
	name_starts_with?: string | undefined | null,
	name_starts_with_nocase?: string | undefined | null,
	name_not_starts_with?: string | undefined | null,
	name_not_starts_with_nocase?: string | undefined | null,
	name_ends_with?: string | undefined | null,
	name_ends_with_nocase?: string | undefined | null,
	name_not_ends_with?: string | undefined | null,
	name_not_ends_with_nocase?: string | undefined | null,
	symbol?: string | undefined | null,
	symbol_not?: string | undefined | null,
	symbol_gt?: string | undefined | null,
	symbol_lt?: string | undefined | null,
	symbol_gte?: string | undefined | null,
	symbol_lte?: string | undefined | null,
	symbol_in?: Array<string> | undefined | null,
	symbol_not_in?: Array<string> | undefined | null,
	symbol_contains?: string | undefined | null,
	symbol_contains_nocase?: string | undefined | null,
	symbol_not_contains?: string | undefined | null,
	symbol_not_contains_nocase?: string | undefined | null,
	symbol_starts_with?: string | undefined | null,
	symbol_starts_with_nocase?: string | undefined | null,
	symbol_not_starts_with?: string | undefined | null,
	symbol_not_starts_with_nocase?: string | undefined | null,
	symbol_ends_with?: string | undefined | null,
	symbol_ends_with_nocase?: string | undefined | null,
	symbol_not_ends_with?: string | undefined | null,
	symbol_not_ends_with_nocase?: string | undefined | null,
	decimals?: number | undefined | null,
	decimals_not?: number | undefined | null,
	decimals_gt?: number | undefined | null,
	decimals_lt?: number | undefined | null,
	decimals_gte?: number | undefined | null,
	decimals_lte?: number | undefined | null,
	decimals_in?: Array<number> | undefined | null,
	decimals_not_in?: Array<number> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["Asset_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["Asset_filter"] | undefined | null> | undefined | null
};
	["Asset_orderBy"]:Asset_orderBy;
	["BigDecimal"]:unknown;
	["BigInt"]:unknown;
	["BlockChangedFilter"]: {
	number_gte: number
};
	["Block_height"]: {
	hash?: ResolverInputTypes["Bytes"] | undefined | null,
	number?: number | undefined | null,
	number_gte?: number | undefined | null
};
	["Bytes"]:unknown;
	["Currency"]:Currency;
	["HistoryItem"]: AliasType<{
	id?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	position?:ResolverInputTypes["Position"],
	fillSize?:boolean | `@${string}`,
	fillCost?:boolean | `@${string}`,
	fillPrice?:boolean | `@${string}`,
	cashflowCcy?:boolean | `@${string}`,
	cashflowBase?:boolean | `@${string}`,
	cashflowQuote?:boolean | `@${string}`,
	equityBase?:boolean | `@${string}`,
	equityQuote?:boolean | `@${string}`,
	previousOpenQuantity?:boolean | `@${string}`,
	openQuantity?:boolean | `@${string}`,
	previousOpenCost?:boolean | `@${string}`,
	openCost?:boolean | `@${string}`,
	closedCost?:boolean | `@${string}`,
	cashflowBaseAcc?:boolean | `@${string}`,
	cashflowQuoteAcc?:boolean | `@${string}`,
	equityBaseAcc?:boolean | `@${string}`,
	equityQuoteAcc?:boolean | `@${string}`,
	feeCcy?:boolean | `@${string}`,
	feeBase?:boolean | `@${string}`,
	feeQuote?:boolean | `@${string}`,
	feeBaseAcc?:boolean | `@${string}`,
	feeQuoteAcc?:boolean | `@${string}`,
	realisedPnLBase?:boolean | `@${string}`,
	realisedPnLQuote?:boolean | `@${string}`,
	spotPrice?:boolean | `@${string}`,
	owner?:ResolverInputTypes["Account"],
	tradedBy?:ResolverInputTypes["Account"],
	blockNumber?:boolean | `@${string}`,
	blockTimestamp?:boolean | `@${string}`,
	transactionHash?:boolean | `@${string}`,
	prevTransactionHash?:boolean | `@${string}`,
	dateTime?:boolean | `@${string}`,
	executionFeeBase?:boolean | `@${string}`,
	executionFeeQuote?:boolean | `@${string}`,
	liquidationPenalty?:boolean | `@${string}`,
	liquidationPenaltyBase?:boolean | `@${string}`,
	liquidationPenaltyQuote?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["HistoryItemType"]:HistoryItemType;
	["HistoryItem_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	type?: ResolverInputTypes["HistoryItemType"] | undefined | null,
	type_not?: ResolverInputTypes["HistoryItemType"] | undefined | null,
	type_in?: Array<ResolverInputTypes["HistoryItemType"]> | undefined | null,
	type_not_in?: Array<ResolverInputTypes["HistoryItemType"]> | undefined | null,
	position?: string | undefined | null,
	position_not?: string | undefined | null,
	position_gt?: string | undefined | null,
	position_lt?: string | undefined | null,
	position_gte?: string | undefined | null,
	position_lte?: string | undefined | null,
	position_in?: Array<string> | undefined | null,
	position_not_in?: Array<string> | undefined | null,
	position_contains?: string | undefined | null,
	position_contains_nocase?: string | undefined | null,
	position_not_contains?: string | undefined | null,
	position_not_contains_nocase?: string | undefined | null,
	position_starts_with?: string | undefined | null,
	position_starts_with_nocase?: string | undefined | null,
	position_not_starts_with?: string | undefined | null,
	position_not_starts_with_nocase?: string | undefined | null,
	position_ends_with?: string | undefined | null,
	position_ends_with_nocase?: string | undefined | null,
	position_not_ends_with?: string | undefined | null,
	position_not_ends_with_nocase?: string | undefined | null,
	position_?: ResolverInputTypes["Position_filter"] | undefined | null,
	fillSize?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillSize_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	fillSize_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	fillCost?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillCost_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	fillCost_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	fillPrice?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	fillPrice_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	fillPrice_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowCcy?: ResolverInputTypes["Currency"] | undefined | null,
	cashflowCcy_not?: ResolverInputTypes["Currency"] | undefined | null,
	cashflowCcy_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	cashflowCcy_not_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	cashflowBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	previousOpenQuantity?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenQuantity_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	previousOpenQuantity_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openQuantity?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openQuantity_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openQuantity_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	previousOpenCost?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	previousOpenCost_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	previousOpenCost_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openCost?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openCost_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	closedCost?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	closedCost_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	closedCost_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowBaseAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBaseAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowBaseAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuoteAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuoteAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuoteAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBaseAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBaseAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBaseAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuoteAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuoteAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuoteAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeCcy?: ResolverInputTypes["Currency"] | undefined | null,
	feeCcy_not?: ResolverInputTypes["Currency"] | undefined | null,
	feeCcy_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	feeCcy_not_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	feeBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeBaseAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeBaseAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeBaseAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeQuoteAcc?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feeQuoteAcc_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feeQuoteAcc_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	spotPrice?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	spotPrice_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	spotPrice_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	owner?: string | undefined | null,
	owner_not?: string | undefined | null,
	owner_gt?: string | undefined | null,
	owner_lt?: string | undefined | null,
	owner_gte?: string | undefined | null,
	owner_lte?: string | undefined | null,
	owner_in?: Array<string> | undefined | null,
	owner_not_in?: Array<string> | undefined | null,
	owner_contains?: string | undefined | null,
	owner_contains_nocase?: string | undefined | null,
	owner_not_contains?: string | undefined | null,
	owner_not_contains_nocase?: string | undefined | null,
	owner_starts_with?: string | undefined | null,
	owner_starts_with_nocase?: string | undefined | null,
	owner_not_starts_with?: string | undefined | null,
	owner_not_starts_with_nocase?: string | undefined | null,
	owner_ends_with?: string | undefined | null,
	owner_ends_with_nocase?: string | undefined | null,
	owner_not_ends_with?: string | undefined | null,
	owner_not_ends_with_nocase?: string | undefined | null,
	owner_?: ResolverInputTypes["Account_filter"] | undefined | null,
	tradedBy?: string | undefined | null,
	tradedBy_not?: string | undefined | null,
	tradedBy_gt?: string | undefined | null,
	tradedBy_lt?: string | undefined | null,
	tradedBy_gte?: string | undefined | null,
	tradedBy_lte?: string | undefined | null,
	tradedBy_in?: Array<string> | undefined | null,
	tradedBy_not_in?: Array<string> | undefined | null,
	tradedBy_contains?: string | undefined | null,
	tradedBy_contains_nocase?: string | undefined | null,
	tradedBy_not_contains?: string | undefined | null,
	tradedBy_not_contains_nocase?: string | undefined | null,
	tradedBy_starts_with?: string | undefined | null,
	tradedBy_starts_with_nocase?: string | undefined | null,
	tradedBy_not_starts_with?: string | undefined | null,
	tradedBy_not_starts_with_nocase?: string | undefined | null,
	tradedBy_ends_with?: string | undefined | null,
	tradedBy_ends_with_nocase?: string | undefined | null,
	tradedBy_not_ends_with?: string | undefined | null,
	tradedBy_not_ends_with_nocase?: string | undefined | null,
	tradedBy_?: ResolverInputTypes["Account_filter"] | undefined | null,
	blockNumber?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_not?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockNumber_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockTimestamp?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_not?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockTimestamp_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	transactionHash?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_not?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_gt?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_lt?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_gte?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_lte?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	transactionHash_not_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	transactionHash_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	transactionHash_not_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_not?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_gt?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_lt?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_gte?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_lte?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	prevTransactionHash_not_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	prevTransactionHash_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	prevTransactionHash_not_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	dateTime?: string | undefined | null,
	dateTime_not?: string | undefined | null,
	dateTime_gt?: string | undefined | null,
	dateTime_lt?: string | undefined | null,
	dateTime_gte?: string | undefined | null,
	dateTime_lte?: string | undefined | null,
	dateTime_in?: Array<string> | undefined | null,
	dateTime_not_in?: Array<string> | undefined | null,
	dateTime_contains?: string | undefined | null,
	dateTime_contains_nocase?: string | undefined | null,
	dateTime_not_contains?: string | undefined | null,
	dateTime_not_contains_nocase?: string | undefined | null,
	dateTime_starts_with?: string | undefined | null,
	dateTime_starts_with_nocase?: string | undefined | null,
	dateTime_not_starts_with?: string | undefined | null,
	dateTime_not_starts_with_nocase?: string | undefined | null,
	dateTime_ends_with?: string | undefined | null,
	dateTime_ends_with_nocase?: string | undefined | null,
	dateTime_not_ends_with?: string | undefined | null,
	dateTime_not_ends_with_nocase?: string | undefined | null,
	executionFeeBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	executionFeeBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	executionFeeQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	executionFeeQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	executionFeeQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenalty?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenalty_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenalty_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenaltyBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenaltyBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenaltyQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	liquidationPenaltyQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	liquidationPenaltyQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["HistoryItem_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["HistoryItem_filter"] | undefined | null> | undefined | null
};
	["HistoryItem_orderBy"]:HistoryItem_orderBy;
	["Instrument"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	base?:ResolverInputTypes["Asset"],
	quote?:ResolverInputTypes["Asset"],
positions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Position_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Position_filter"] | undefined | null},ResolverInputTypes["Position"]],
orders?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Order_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Order_filter"] | undefined | null},ResolverInputTypes["Order"]],
		__typename?: boolean | `@${string}`
}>;
	["InstrumentTotal"]: AliasType<{
	id?:boolean | `@${string}`,
	symbol?:boolean | `@${string}`,
	openInterest?:boolean | `@${string}`,
	totalVolume?:boolean | `@${string}`,
	totalFees?:boolean | `@${string}`,
	openPositions?:boolean | `@${string}`,
	totalPositions?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["InstrumentTotal_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	symbol?: string | undefined | null,
	symbol_not?: string | undefined | null,
	symbol_gt?: string | undefined | null,
	symbol_lt?: string | undefined | null,
	symbol_gte?: string | undefined | null,
	symbol_lte?: string | undefined | null,
	symbol_in?: Array<string> | undefined | null,
	symbol_not_in?: Array<string> | undefined | null,
	symbol_contains?: string | undefined | null,
	symbol_contains_nocase?: string | undefined | null,
	symbol_not_contains?: string | undefined | null,
	symbol_not_contains_nocase?: string | undefined | null,
	symbol_starts_with?: string | undefined | null,
	symbol_starts_with_nocase?: string | undefined | null,
	symbol_not_starts_with?: string | undefined | null,
	symbol_not_starts_with_nocase?: string | undefined | null,
	symbol_ends_with?: string | undefined | null,
	symbol_ends_with_nocase?: string | undefined | null,
	symbol_not_ends_with?: string | undefined | null,
	symbol_not_ends_with_nocase?: string | undefined | null,
	openInterest?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openInterest_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openInterest_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalVolume?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalVolume_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalVolume_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalFees?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	totalFees_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	totalFees_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openPositions?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_not?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	openPositions_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	openPositions_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	totalPositions?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_not?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	totalPositions_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	totalPositions_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["InstrumentTotal_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["InstrumentTotal_filter"] | undefined | null> | undefined | null
};
	["InstrumentTotal_orderBy"]:InstrumentTotal_orderBy;
	["Instrument_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	symbol?: string | undefined | null,
	symbol_not?: string | undefined | null,
	symbol_gt?: string | undefined | null,
	symbol_lt?: string | undefined | null,
	symbol_gte?: string | undefined | null,
	symbol_lte?: string | undefined | null,
	symbol_in?: Array<string> | undefined | null,
	symbol_not_in?: Array<string> | undefined | null,
	symbol_contains?: string | undefined | null,
	symbol_contains_nocase?: string | undefined | null,
	symbol_not_contains?: string | undefined | null,
	symbol_not_contains_nocase?: string | undefined | null,
	symbol_starts_with?: string | undefined | null,
	symbol_starts_with_nocase?: string | undefined | null,
	symbol_not_starts_with?: string | undefined | null,
	symbol_not_starts_with_nocase?: string | undefined | null,
	symbol_ends_with?: string | undefined | null,
	symbol_ends_with_nocase?: string | undefined | null,
	symbol_not_ends_with?: string | undefined | null,
	symbol_not_ends_with_nocase?: string | undefined | null,
	base?: string | undefined | null,
	base_not?: string | undefined | null,
	base_gt?: string | undefined | null,
	base_lt?: string | undefined | null,
	base_gte?: string | undefined | null,
	base_lte?: string | undefined | null,
	base_in?: Array<string> | undefined | null,
	base_not_in?: Array<string> | undefined | null,
	base_contains?: string | undefined | null,
	base_contains_nocase?: string | undefined | null,
	base_not_contains?: string | undefined | null,
	base_not_contains_nocase?: string | undefined | null,
	base_starts_with?: string | undefined | null,
	base_starts_with_nocase?: string | undefined | null,
	base_not_starts_with?: string | undefined | null,
	base_not_starts_with_nocase?: string | undefined | null,
	base_ends_with?: string | undefined | null,
	base_ends_with_nocase?: string | undefined | null,
	base_not_ends_with?: string | undefined | null,
	base_not_ends_with_nocase?: string | undefined | null,
	base_?: ResolverInputTypes["Asset_filter"] | undefined | null,
	quote?: string | undefined | null,
	quote_not?: string | undefined | null,
	quote_gt?: string | undefined | null,
	quote_lt?: string | undefined | null,
	quote_gte?: string | undefined | null,
	quote_lte?: string | undefined | null,
	quote_in?: Array<string> | undefined | null,
	quote_not_in?: Array<string> | undefined | null,
	quote_contains?: string | undefined | null,
	quote_contains_nocase?: string | undefined | null,
	quote_not_contains?: string | undefined | null,
	quote_not_contains_nocase?: string | undefined | null,
	quote_starts_with?: string | undefined | null,
	quote_starts_with_nocase?: string | undefined | null,
	quote_not_starts_with?: string | undefined | null,
	quote_not_starts_with_nocase?: string | undefined | null,
	quote_ends_with?: string | undefined | null,
	quote_ends_with_nocase?: string | undefined | null,
	quote_not_ends_with?: string | undefined | null,
	quote_not_ends_with_nocase?: string | undefined | null,
	quote_?: ResolverInputTypes["Asset_filter"] | undefined | null,
	positions_?: ResolverInputTypes["Position_filter"] | undefined | null,
	orders_?: ResolverInputTypes["Order_filter"] | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["Instrument_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["Instrument_filter"] | undefined | null> | undefined | null
};
	["Instrument_orderBy"]:Instrument_orderBy;
	/** 8 bytes signed integer */
["Int8"]:unknown;
	["MoneyMarket"]:MoneyMarket;
	["Order"]: AliasType<{
	id?:boolean | `@${string}`,
	position?:ResolverInputTypes["Position"],
	instrument?:ResolverInputTypes["Instrument"],
	owner?:ResolverInputTypes["Account"],
	side?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	quantity?:boolean | `@${string}`,
	limitPrice?:boolean | `@${string}`,
	tolerance?:boolean | `@${string}`,
	cashflow?:boolean | `@${string}`,
	cashflowCcy?:boolean | `@${string}`,
	deadline?:boolean | `@${string}`,
	placedBy?:ResolverInputTypes["Account"],
	blockNumber?:boolean | `@${string}`,
	blockTimestamp?:boolean | `@${string}`,
	dateTime?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Defines the order direction, either ascending or descending */
["OrderDirection"]:OrderDirection;
	["OrderType"]:OrderType;
	["Order_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	position?: string | undefined | null,
	position_not?: string | undefined | null,
	position_gt?: string | undefined | null,
	position_lt?: string | undefined | null,
	position_gte?: string | undefined | null,
	position_lte?: string | undefined | null,
	position_in?: Array<string> | undefined | null,
	position_not_in?: Array<string> | undefined | null,
	position_contains?: string | undefined | null,
	position_contains_nocase?: string | undefined | null,
	position_not_contains?: string | undefined | null,
	position_not_contains_nocase?: string | undefined | null,
	position_starts_with?: string | undefined | null,
	position_starts_with_nocase?: string | undefined | null,
	position_not_starts_with?: string | undefined | null,
	position_not_starts_with_nocase?: string | undefined | null,
	position_ends_with?: string | undefined | null,
	position_ends_with_nocase?: string | undefined | null,
	position_not_ends_with?: string | undefined | null,
	position_not_ends_with_nocase?: string | undefined | null,
	position_?: ResolverInputTypes["Position_filter"] | undefined | null,
	instrument?: string | undefined | null,
	instrument_not?: string | undefined | null,
	instrument_gt?: string | undefined | null,
	instrument_lt?: string | undefined | null,
	instrument_gte?: string | undefined | null,
	instrument_lte?: string | undefined | null,
	instrument_in?: Array<string> | undefined | null,
	instrument_not_in?: Array<string> | undefined | null,
	instrument_contains?: string | undefined | null,
	instrument_contains_nocase?: string | undefined | null,
	instrument_not_contains?: string | undefined | null,
	instrument_not_contains_nocase?: string | undefined | null,
	instrument_starts_with?: string | undefined | null,
	instrument_starts_with_nocase?: string | undefined | null,
	instrument_not_starts_with?: string | undefined | null,
	instrument_not_starts_with_nocase?: string | undefined | null,
	instrument_ends_with?: string | undefined | null,
	instrument_ends_with_nocase?: string | undefined | null,
	instrument_not_ends_with?: string | undefined | null,
	instrument_not_ends_with_nocase?: string | undefined | null,
	instrument_?: ResolverInputTypes["Instrument_filter"] | undefined | null,
	owner?: string | undefined | null,
	owner_not?: string | undefined | null,
	owner_gt?: string | undefined | null,
	owner_lt?: string | undefined | null,
	owner_gte?: string | undefined | null,
	owner_lte?: string | undefined | null,
	owner_in?: Array<string> | undefined | null,
	owner_not_in?: Array<string> | undefined | null,
	owner_contains?: string | undefined | null,
	owner_contains_nocase?: string | undefined | null,
	owner_not_contains?: string | undefined | null,
	owner_not_contains_nocase?: string | undefined | null,
	owner_starts_with?: string | undefined | null,
	owner_starts_with_nocase?: string | undefined | null,
	owner_not_starts_with?: string | undefined | null,
	owner_not_starts_with_nocase?: string | undefined | null,
	owner_ends_with?: string | undefined | null,
	owner_ends_with_nocase?: string | undefined | null,
	owner_not_ends_with?: string | undefined | null,
	owner_not_ends_with_nocase?: string | undefined | null,
	owner_?: ResolverInputTypes["Account_filter"] | undefined | null,
	side?: ResolverInputTypes["Side"] | undefined | null,
	side_not?: ResolverInputTypes["Side"] | undefined | null,
	side_in?: Array<ResolverInputTypes["Side"]> | undefined | null,
	side_not_in?: Array<ResolverInputTypes["Side"]> | undefined | null,
	type?: ResolverInputTypes["OrderType"] | undefined | null,
	type_not?: ResolverInputTypes["OrderType"] | undefined | null,
	type_in?: Array<ResolverInputTypes["OrderType"]> | undefined | null,
	type_not_in?: Array<ResolverInputTypes["OrderType"]> | undefined | null,
	quantity?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_not?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	quantity_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	quantity_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	limitPrice?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_not?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	limitPrice_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	limitPrice_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	tolerance?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_not?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	tolerance_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	tolerance_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	cashflow?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_not?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	cashflow_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	cashflow_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	cashflowCcy?: ResolverInputTypes["Currency"] | undefined | null,
	cashflowCcy_not?: ResolverInputTypes["Currency"] | undefined | null,
	cashflowCcy_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	cashflowCcy_not_in?: Array<ResolverInputTypes["Currency"]> | undefined | null,
	deadline?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_not?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	deadline_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	deadline_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	placedBy?: string | undefined | null,
	placedBy_not?: string | undefined | null,
	placedBy_gt?: string | undefined | null,
	placedBy_lt?: string | undefined | null,
	placedBy_gte?: string | undefined | null,
	placedBy_lte?: string | undefined | null,
	placedBy_in?: Array<string> | undefined | null,
	placedBy_not_in?: Array<string> | undefined | null,
	placedBy_contains?: string | undefined | null,
	placedBy_contains_nocase?: string | undefined | null,
	placedBy_not_contains?: string | undefined | null,
	placedBy_not_contains_nocase?: string | undefined | null,
	placedBy_starts_with?: string | undefined | null,
	placedBy_starts_with_nocase?: string | undefined | null,
	placedBy_not_starts_with?: string | undefined | null,
	placedBy_not_starts_with_nocase?: string | undefined | null,
	placedBy_ends_with?: string | undefined | null,
	placedBy_ends_with_nocase?: string | undefined | null,
	placedBy_not_ends_with?: string | undefined | null,
	placedBy_not_ends_with_nocase?: string | undefined | null,
	placedBy_?: ResolverInputTypes["Account_filter"] | undefined | null,
	blockNumber?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_not?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockNumber_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockNumber_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockTimestamp?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_not?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	blockTimestamp_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	blockTimestamp_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	dateTime?: string | undefined | null,
	dateTime_not?: string | undefined | null,
	dateTime_gt?: string | undefined | null,
	dateTime_lt?: string | undefined | null,
	dateTime_gte?: string | undefined | null,
	dateTime_lte?: string | undefined | null,
	dateTime_in?: Array<string> | undefined | null,
	dateTime_not_in?: Array<string> | undefined | null,
	dateTime_contains?: string | undefined | null,
	dateTime_contains_nocase?: string | undefined | null,
	dateTime_not_contains?: string | undefined | null,
	dateTime_not_contains_nocase?: string | undefined | null,
	dateTime_starts_with?: string | undefined | null,
	dateTime_starts_with_nocase?: string | undefined | null,
	dateTime_not_starts_with?: string | undefined | null,
	dateTime_not_starts_with_nocase?: string | undefined | null,
	dateTime_ends_with?: string | undefined | null,
	dateTime_ends_with_nocase?: string | undefined | null,
	dateTime_not_ends_with?: string | undefined | null,
	dateTime_not_ends_with_nocase?: string | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["Order_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["Order_filter"] | undefined | null> | undefined | null
};
	["Order_orderBy"]:Order_orderBy;
	["Position"]: AliasType<{
	id?:boolean | `@${string}`,
	instrument?:ResolverInputTypes["Instrument"],
	owner?:ResolverInputTypes["Account"],
	moneyMarket?:boolean | `@${string}`,
	number?:boolean | `@${string}`,
	expiry?:boolean | `@${string}`,
	quantity?:boolean | `@${string}`,
	openCost?:boolean | `@${string}`,
	feesBase?:boolean | `@${string}`,
	feesQuote?:boolean | `@${string}`,
	realisedPnLBase?:boolean | `@${string}`,
	realisedPnLQuote?:boolean | `@${string}`,
	cashflowBase?:boolean | `@${string}`,
	cashflowQuote?:boolean | `@${string}`,
	equityBase?:boolean | `@${string}`,
	equityQuote?:boolean | `@${string}`,
history?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["HistoryItem_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["HistoryItem_filter"] | undefined | null},ResolverInputTypes["HistoryItem"]],
orders?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Order_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Order_filter"] | undefined | null},ResolverInputTypes["Order"]],
	latestTransactionHash?:boolean | `@${string}`,
	creationBlockNumber?:boolean | `@${string}`,
	creationBlockTimestamp?:boolean | `@${string}`,
	creationTransactionHash?:boolean | `@${string}`,
	creationDateTime?:boolean | `@${string}`,
	claimableRewards?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Position_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	instrument?: string | undefined | null,
	instrument_not?: string | undefined | null,
	instrument_gt?: string | undefined | null,
	instrument_lt?: string | undefined | null,
	instrument_gte?: string | undefined | null,
	instrument_lte?: string | undefined | null,
	instrument_in?: Array<string> | undefined | null,
	instrument_not_in?: Array<string> | undefined | null,
	instrument_contains?: string | undefined | null,
	instrument_contains_nocase?: string | undefined | null,
	instrument_not_contains?: string | undefined | null,
	instrument_not_contains_nocase?: string | undefined | null,
	instrument_starts_with?: string | undefined | null,
	instrument_starts_with_nocase?: string | undefined | null,
	instrument_not_starts_with?: string | undefined | null,
	instrument_not_starts_with_nocase?: string | undefined | null,
	instrument_ends_with?: string | undefined | null,
	instrument_ends_with_nocase?: string | undefined | null,
	instrument_not_ends_with?: string | undefined | null,
	instrument_not_ends_with_nocase?: string | undefined | null,
	instrument_?: ResolverInputTypes["Instrument_filter"] | undefined | null,
	owner?: string | undefined | null,
	owner_not?: string | undefined | null,
	owner_gt?: string | undefined | null,
	owner_lt?: string | undefined | null,
	owner_gte?: string | undefined | null,
	owner_lte?: string | undefined | null,
	owner_in?: Array<string> | undefined | null,
	owner_not_in?: Array<string> | undefined | null,
	owner_contains?: string | undefined | null,
	owner_contains_nocase?: string | undefined | null,
	owner_not_contains?: string | undefined | null,
	owner_not_contains_nocase?: string | undefined | null,
	owner_starts_with?: string | undefined | null,
	owner_starts_with_nocase?: string | undefined | null,
	owner_not_starts_with?: string | undefined | null,
	owner_not_starts_with_nocase?: string | undefined | null,
	owner_ends_with?: string | undefined | null,
	owner_ends_with_nocase?: string | undefined | null,
	owner_not_ends_with?: string | undefined | null,
	owner_not_ends_with_nocase?: string | undefined | null,
	owner_?: ResolverInputTypes["Account_filter"] | undefined | null,
	moneyMarket?: ResolverInputTypes["MoneyMarket"] | undefined | null,
	moneyMarket_not?: ResolverInputTypes["MoneyMarket"] | undefined | null,
	moneyMarket_in?: Array<ResolverInputTypes["MoneyMarket"]> | undefined | null,
	moneyMarket_not_in?: Array<ResolverInputTypes["MoneyMarket"]> | undefined | null,
	number?: ResolverInputTypes["BigInt"] | undefined | null,
	number_not?: ResolverInputTypes["BigInt"] | undefined | null,
	number_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	number_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	number_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	number_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	number_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	number_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	expiry?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_not?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	expiry_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	expiry_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	quantity?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	quantity_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	quantity_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openCost?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	openCost_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	openCost_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feesBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feesBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feesQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	feesQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	feesQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	realisedPnLQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	realisedPnLQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	cashflowQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	cashflowQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBase?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityBase_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityBase_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuote?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	equityQuote_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	equityQuote_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	history_?: ResolverInputTypes["HistoryItem_filter"] | undefined | null,
	orders_?: ResolverInputTypes["Order_filter"] | undefined | null,
	latestTransactionHash?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_not?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_gt?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_lt?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_gte?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_lte?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	latestTransactionHash_not_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	latestTransactionHash_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	latestTransactionHash_not_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	creationBlockNumber?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_not?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockNumber_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	creationBlockNumber_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	creationBlockTimestamp?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_not?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_gt?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_lt?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_gte?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_lte?: ResolverInputTypes["BigInt"] | undefined | null,
	creationBlockTimestamp_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	creationBlockTimestamp_not_in?: Array<ResolverInputTypes["BigInt"]> | undefined | null,
	creationTransactionHash?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_not?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_gt?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_lt?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_gte?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_lte?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	creationTransactionHash_not_in?: Array<ResolverInputTypes["Bytes"]> | undefined | null,
	creationTransactionHash_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	creationTransactionHash_not_contains?: ResolverInputTypes["Bytes"] | undefined | null,
	creationDateTime?: string | undefined | null,
	creationDateTime_not?: string | undefined | null,
	creationDateTime_gt?: string | undefined | null,
	creationDateTime_lt?: string | undefined | null,
	creationDateTime_gte?: string | undefined | null,
	creationDateTime_lte?: string | undefined | null,
	creationDateTime_in?: Array<string> | undefined | null,
	creationDateTime_not_in?: Array<string> | undefined | null,
	creationDateTime_contains?: string | undefined | null,
	creationDateTime_contains_nocase?: string | undefined | null,
	creationDateTime_not_contains?: string | undefined | null,
	creationDateTime_not_contains_nocase?: string | undefined | null,
	creationDateTime_starts_with?: string | undefined | null,
	creationDateTime_starts_with_nocase?: string | undefined | null,
	creationDateTime_not_starts_with?: string | undefined | null,
	creationDateTime_not_starts_with_nocase?: string | undefined | null,
	creationDateTime_ends_with?: string | undefined | null,
	creationDateTime_ends_with_nocase?: string | undefined | null,
	creationDateTime_not_ends_with?: string | undefined | null,
	creationDateTime_not_ends_with_nocase?: string | undefined | null,
	claimableRewards?: boolean | undefined | null,
	claimableRewards_not?: boolean | undefined | null,
	claimableRewards_in?: Array<boolean> | undefined | null,
	claimableRewards_not_in?: Array<boolean> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["Position_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["Position_filter"] | undefined | null> | undefined | null
};
	["Position_orderBy"]:Position_orderBy;
	["Query"]: AliasType<{
asset?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Asset"]],
assets?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Asset_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Asset_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Asset"]],
assetTotal?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["AssetTotal"]],
assetTotals?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["AssetTotal_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["AssetTotal_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["AssetTotal"]],
instrument?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Instrument"]],
instruments?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Instrument_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Instrument_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Instrument"]],
instrumentTotal?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["InstrumentTotal"]],
instrumentTotals?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["InstrumentTotal_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["InstrumentTotal_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["InstrumentTotal"]],
underlyingPosition?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["UnderlyingPosition"]],
underlyingPositions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["UnderlyingPosition_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["UnderlyingPosition_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["UnderlyingPosition"]],
account?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Account"]],
accounts?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Account_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Account_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Account"]],
referralCounter?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["ReferralCounter"]],
referralCounters?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["ReferralCounter_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["ReferralCounter_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["ReferralCounter"]],
position?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Position"]],
positions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Position_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Position_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Position"]],
historyItem?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["HistoryItem"]],
historyItems?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["HistoryItem_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["HistoryItem_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["HistoryItem"]],
order?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Order"]],
orders?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Order_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Order_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Order"]],
_meta?: [{	block?: ResolverInputTypes["Block_height"] | undefined | null},ResolverInputTypes["_Meta_"]],
		__typename?: boolean | `@${string}`
}>;
	["ReferralCounter"]: AliasType<{
	id?:boolean | `@${string}`,
	account?:ResolverInputTypes["Account"],
	asset?:ResolverInputTypes["Asset"],
	rebates?:boolean | `@${string}`,
	rewards?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ReferralCounter_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	account?: string | undefined | null,
	account_not?: string | undefined | null,
	account_gt?: string | undefined | null,
	account_lt?: string | undefined | null,
	account_gte?: string | undefined | null,
	account_lte?: string | undefined | null,
	account_in?: Array<string> | undefined | null,
	account_not_in?: Array<string> | undefined | null,
	account_contains?: string | undefined | null,
	account_contains_nocase?: string | undefined | null,
	account_not_contains?: string | undefined | null,
	account_not_contains_nocase?: string | undefined | null,
	account_starts_with?: string | undefined | null,
	account_starts_with_nocase?: string | undefined | null,
	account_not_starts_with?: string | undefined | null,
	account_not_starts_with_nocase?: string | undefined | null,
	account_ends_with?: string | undefined | null,
	account_ends_with_nocase?: string | undefined | null,
	account_not_ends_with?: string | undefined | null,
	account_not_ends_with_nocase?: string | undefined | null,
	account_?: ResolverInputTypes["Account_filter"] | undefined | null,
	asset?: string | undefined | null,
	asset_not?: string | undefined | null,
	asset_gt?: string | undefined | null,
	asset_lt?: string | undefined | null,
	asset_gte?: string | undefined | null,
	asset_lte?: string | undefined | null,
	asset_in?: Array<string> | undefined | null,
	asset_not_in?: Array<string> | undefined | null,
	asset_contains?: string | undefined | null,
	asset_contains_nocase?: string | undefined | null,
	asset_not_contains?: string | undefined | null,
	asset_not_contains_nocase?: string | undefined | null,
	asset_starts_with?: string | undefined | null,
	asset_starts_with_nocase?: string | undefined | null,
	asset_not_starts_with?: string | undefined | null,
	asset_not_starts_with_nocase?: string | undefined | null,
	asset_ends_with?: string | undefined | null,
	asset_ends_with_nocase?: string | undefined | null,
	asset_not_ends_with?: string | undefined | null,
	asset_not_ends_with_nocase?: string | undefined | null,
	asset_?: ResolverInputTypes["Asset_filter"] | undefined | null,
	rebates?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rebates_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	rebates_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	rewards?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_not?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_gt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_lt?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_gte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_lte?: ResolverInputTypes["BigDecimal"] | undefined | null,
	rewards_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	rewards_not_in?: Array<ResolverInputTypes["BigDecimal"]> | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["ReferralCounter_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["ReferralCounter_filter"] | undefined | null> | undefined | null
};
	["ReferralCounter_orderBy"]:ReferralCounter_orderBy;
	["Side"]:Side;
	["Subscription"]: AliasType<{
asset?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Asset"]],
assets?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Asset_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Asset_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Asset"]],
assetTotal?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["AssetTotal"]],
assetTotals?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["AssetTotal_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["AssetTotal_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["AssetTotal"]],
instrument?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Instrument"]],
instruments?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Instrument_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Instrument_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Instrument"]],
instrumentTotal?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["InstrumentTotal"]],
instrumentTotals?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["InstrumentTotal_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["InstrumentTotal_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["InstrumentTotal"]],
underlyingPosition?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["UnderlyingPosition"]],
underlyingPositions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["UnderlyingPosition_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["UnderlyingPosition_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["UnderlyingPosition"]],
account?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Account"]],
accounts?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Account_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Account_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Account"]],
referralCounter?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["ReferralCounter"]],
referralCounters?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["ReferralCounter_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["ReferralCounter_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["ReferralCounter"]],
position?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Position"]],
positions?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Position_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Position_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Position"]],
historyItem?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["HistoryItem"]],
historyItems?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["HistoryItem_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["HistoryItem_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["HistoryItem"]],
order?: [{	id: string,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Order"]],
orders?: [{	skip?: number | undefined | null,	first?: number | undefined | null,	orderBy?: ResolverInputTypes["Order_orderBy"] | undefined | null,	orderDirection?: ResolverInputTypes["OrderDirection"] | undefined | null,	where?: ResolverInputTypes["Order_filter"] | undefined | null,	/** The block at which the query should be executed. Can either be a `{ hash: Bytes }` value containing a block hash, a `{ number: Int }` containing the block number, or a `{ number_gte: Int }` containing the minimum block number. In the case of `number_gte`, the query will be executed on the latest block only if the subgraph has progressed to or past the minimum block number. Defaults to the latest block when omitted. */
	block?: ResolverInputTypes["Block_height"] | undefined | null,	/** Set to `allow` to receive data even if the subgraph has skipped over errors while syncing. */
	subgraphError: ResolverInputTypes["_SubgraphErrorPolicy_"]},ResolverInputTypes["Order"]],
_meta?: [{	block?: ResolverInputTypes["Block_height"] | undefined | null},ResolverInputTypes["_Meta_"]],
		__typename?: boolean | `@${string}`
}>;
	["UnderlyingPosition"]: AliasType<{
	id?:boolean | `@${string}`,
	position?:ResolverInputTypes["Position"],
		__typename?: boolean | `@${string}`
}>;
	["UnderlyingPosition_filter"]: {
	id?: string | undefined | null,
	id_not?: string | undefined | null,
	id_gt?: string | undefined | null,
	id_lt?: string | undefined | null,
	id_gte?: string | undefined | null,
	id_lte?: string | undefined | null,
	id_in?: Array<string> | undefined | null,
	id_not_in?: Array<string> | undefined | null,
	position?: string | undefined | null,
	position_not?: string | undefined | null,
	position_gt?: string | undefined | null,
	position_lt?: string | undefined | null,
	position_gte?: string | undefined | null,
	position_lte?: string | undefined | null,
	position_in?: Array<string> | undefined | null,
	position_not_in?: Array<string> | undefined | null,
	position_contains?: string | undefined | null,
	position_contains_nocase?: string | undefined | null,
	position_not_contains?: string | undefined | null,
	position_not_contains_nocase?: string | undefined | null,
	position_starts_with?: string | undefined | null,
	position_starts_with_nocase?: string | undefined | null,
	position_not_starts_with?: string | undefined | null,
	position_not_starts_with_nocase?: string | undefined | null,
	position_ends_with?: string | undefined | null,
	position_ends_with_nocase?: string | undefined | null,
	position_not_ends_with?: string | undefined | null,
	position_not_ends_with_nocase?: string | undefined | null,
	position_?: ResolverInputTypes["Position_filter"] | undefined | null,
	/** Filter for the block changed event. */
	_change_block?: ResolverInputTypes["BlockChangedFilter"] | undefined | null,
	and?: Array<ResolverInputTypes["UnderlyingPosition_filter"] | undefined | null> | undefined | null,
	or?: Array<ResolverInputTypes["UnderlyingPosition_filter"] | undefined | null> | undefined | null
};
	["UnderlyingPosition_orderBy"]:UnderlyingPosition_orderBy;
	["_Block_"]: AliasType<{
	/** The hash of the block */
	hash?:boolean | `@${string}`,
	/** The block number */
	number?:boolean | `@${string}`,
	/** Integer representation of the timestamp stored in blocks for the chain */
	timestamp?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** The type for the top-level _meta field */
["_Meta_"]: AliasType<{
	/** Information about a specific subgraph block. The hash of the block
will be null if the _meta field has a block constraint that asks for
a block number. It will be filled if the _meta field has no block constraint
and therefore asks for the latest  block */
	block?:ResolverInputTypes["_Block_"],
	/** The deployment ID */
	deployment?:boolean | `@${string}`,
	/** If `true`, the subgraph encountered indexing errors at some past block */
	hasIndexingErrors?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["_SubgraphErrorPolicy_"]:_SubgraphErrorPolicy_;
	["schema"]: AliasType<{
	query?:ResolverInputTypes["Query"],
	subscription?:ResolverInputTypes["Subscription"],
		__typename?: boolean | `@${string}`
}>
  }

export type ModelTypes = {
    ["Account"]: {
		id: string,
	positions: Array<ModelTypes["Position"]>,
	orders: Array<ModelTypes["Order"]>,
	referralCounters: Array<ModelTypes["ReferralCounter"]>,
	referralCode?: string | undefined,
	referredByCode?: string | undefined
};
	["Account_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	positions_?: ModelTypes["Position_filter"] | undefined,
	orders_?: ModelTypes["Order_filter"] | undefined,
	referralCounters_?: ModelTypes["ReferralCounter_filter"] | undefined,
	referralCode?: string | undefined,
	referralCode_not?: string | undefined,
	referralCode_gt?: string | undefined,
	referralCode_lt?: string | undefined,
	referralCode_gte?: string | undefined,
	referralCode_lte?: string | undefined,
	referralCode_in?: Array<string> | undefined,
	referralCode_not_in?: Array<string> | undefined,
	referralCode_contains?: string | undefined,
	referralCode_contains_nocase?: string | undefined,
	referralCode_not_contains?: string | undefined,
	referralCode_not_contains_nocase?: string | undefined,
	referralCode_starts_with?: string | undefined,
	referralCode_starts_with_nocase?: string | undefined,
	referralCode_not_starts_with?: string | undefined,
	referralCode_not_starts_with_nocase?: string | undefined,
	referralCode_ends_with?: string | undefined,
	referralCode_ends_with_nocase?: string | undefined,
	referralCode_not_ends_with?: string | undefined,
	referralCode_not_ends_with_nocase?: string | undefined,
	referredByCode?: string | undefined,
	referredByCode_not?: string | undefined,
	referredByCode_gt?: string | undefined,
	referredByCode_lt?: string | undefined,
	referredByCode_gte?: string | undefined,
	referredByCode_lte?: string | undefined,
	referredByCode_in?: Array<string> | undefined,
	referredByCode_not_in?: Array<string> | undefined,
	referredByCode_contains?: string | undefined,
	referredByCode_contains_nocase?: string | undefined,
	referredByCode_not_contains?: string | undefined,
	referredByCode_not_contains_nocase?: string | undefined,
	referredByCode_starts_with?: string | undefined,
	referredByCode_starts_with_nocase?: string | undefined,
	referredByCode_not_starts_with?: string | undefined,
	referredByCode_not_starts_with_nocase?: string | undefined,
	referredByCode_ends_with?: string | undefined,
	referredByCode_ends_with_nocase?: string | undefined,
	referredByCode_not_ends_with?: string | undefined,
	referredByCode_not_ends_with_nocase?: string | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["Account_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["Account_filter"] | undefined> | undefined
};
	["Account_orderBy"]:Account_orderBy;
	["Asset"]: {
		id: string,
	name: string,
	symbol: string,
	decimals: number
};
	["AssetTotal"]: {
		id: string,
	symbol: string,
	openInterest: ModelTypes["BigDecimal"],
	totalVolume: ModelTypes["BigDecimal"],
	totalFees: ModelTypes["BigDecimal"],
	openPositions: ModelTypes["BigInt"],
	totalPositions: ModelTypes["BigInt"]
};
	["AssetTotal_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	openInterest?: ModelTypes["BigDecimal"] | undefined,
	openInterest_not?: ModelTypes["BigDecimal"] | undefined,
	openInterest_gt?: ModelTypes["BigDecimal"] | undefined,
	openInterest_lt?: ModelTypes["BigDecimal"] | undefined,
	openInterest_gte?: ModelTypes["BigDecimal"] | undefined,
	openInterest_lte?: ModelTypes["BigDecimal"] | undefined,
	openInterest_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openInterest_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalVolume?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_not?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_gt?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_lt?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_gte?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_lte?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalVolume_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalFees?: ModelTypes["BigDecimal"] | undefined,
	totalFees_not?: ModelTypes["BigDecimal"] | undefined,
	totalFees_gt?: ModelTypes["BigDecimal"] | undefined,
	totalFees_lt?: ModelTypes["BigDecimal"] | undefined,
	totalFees_gte?: ModelTypes["BigDecimal"] | undefined,
	totalFees_lte?: ModelTypes["BigDecimal"] | undefined,
	totalFees_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalFees_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openPositions?: ModelTypes["BigInt"] | undefined,
	openPositions_not?: ModelTypes["BigInt"] | undefined,
	openPositions_gt?: ModelTypes["BigInt"] | undefined,
	openPositions_lt?: ModelTypes["BigInt"] | undefined,
	openPositions_gte?: ModelTypes["BigInt"] | undefined,
	openPositions_lte?: ModelTypes["BigInt"] | undefined,
	openPositions_in?: Array<ModelTypes["BigInt"]> | undefined,
	openPositions_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	totalPositions?: ModelTypes["BigInt"] | undefined,
	totalPositions_not?: ModelTypes["BigInt"] | undefined,
	totalPositions_gt?: ModelTypes["BigInt"] | undefined,
	totalPositions_lt?: ModelTypes["BigInt"] | undefined,
	totalPositions_gte?: ModelTypes["BigInt"] | undefined,
	totalPositions_lte?: ModelTypes["BigInt"] | undefined,
	totalPositions_in?: Array<ModelTypes["BigInt"]> | undefined,
	totalPositions_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["AssetTotal_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["AssetTotal_filter"] | undefined> | undefined
};
	["AssetTotal_orderBy"]:AssetTotal_orderBy;
	["Asset_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	name?: string | undefined,
	name_not?: string | undefined,
	name_gt?: string | undefined,
	name_lt?: string | undefined,
	name_gte?: string | undefined,
	name_lte?: string | undefined,
	name_in?: Array<string> | undefined,
	name_not_in?: Array<string> | undefined,
	name_contains?: string | undefined,
	name_contains_nocase?: string | undefined,
	name_not_contains?: string | undefined,
	name_not_contains_nocase?: string | undefined,
	name_starts_with?: string | undefined,
	name_starts_with_nocase?: string | undefined,
	name_not_starts_with?: string | undefined,
	name_not_starts_with_nocase?: string | undefined,
	name_ends_with?: string | undefined,
	name_ends_with_nocase?: string | undefined,
	name_not_ends_with?: string | undefined,
	name_not_ends_with_nocase?: string | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	decimals?: number | undefined,
	decimals_not?: number | undefined,
	decimals_gt?: number | undefined,
	decimals_lt?: number | undefined,
	decimals_gte?: number | undefined,
	decimals_lte?: number | undefined,
	decimals_in?: Array<number> | undefined,
	decimals_not_in?: Array<number> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["Asset_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["Asset_filter"] | undefined> | undefined
};
	["Asset_orderBy"]:Asset_orderBy;
	["BigDecimal"]:any;
	["BigInt"]:any;
	["BlockChangedFilter"]: {
	number_gte: number
};
	["Block_height"]: {
	hash?: ModelTypes["Bytes"] | undefined,
	number?: number | undefined,
	number_gte?: number | undefined
};
	["Bytes"]:any;
	["Currency"]:Currency;
	["HistoryItem"]: {
		id: string,
	type: ModelTypes["HistoryItemType"],
	position: ModelTypes["Position"],
	fillSize: ModelTypes["BigDecimal"],
	fillCost: ModelTypes["BigDecimal"],
	fillPrice: ModelTypes["BigDecimal"],
	cashflowCcy: ModelTypes["Currency"],
	cashflowBase: ModelTypes["BigDecimal"],
	cashflowQuote: ModelTypes["BigDecimal"],
	equityBase: ModelTypes["BigDecimal"],
	equityQuote: ModelTypes["BigDecimal"],
	previousOpenQuantity: ModelTypes["BigDecimal"],
	openQuantity: ModelTypes["BigDecimal"],
	previousOpenCost: ModelTypes["BigDecimal"],
	openCost: ModelTypes["BigDecimal"],
	closedCost: ModelTypes["BigDecimal"],
	cashflowBaseAcc: ModelTypes["BigDecimal"],
	cashflowQuoteAcc: ModelTypes["BigDecimal"],
	equityBaseAcc: ModelTypes["BigDecimal"],
	equityQuoteAcc: ModelTypes["BigDecimal"],
	feeCcy: ModelTypes["Currency"],
	feeBase: ModelTypes["BigDecimal"],
	feeQuote: ModelTypes["BigDecimal"],
	feeBaseAcc: ModelTypes["BigDecimal"],
	feeQuoteAcc: ModelTypes["BigDecimal"],
	realisedPnLBase: ModelTypes["BigDecimal"],
	realisedPnLQuote: ModelTypes["BigDecimal"],
	spotPrice?: ModelTypes["BigDecimal"] | undefined,
	owner: ModelTypes["Account"],
	tradedBy: ModelTypes["Account"],
	blockNumber: ModelTypes["BigInt"],
	blockTimestamp: ModelTypes["BigInt"],
	transactionHash: ModelTypes["Bytes"],
	prevTransactionHash?: ModelTypes["Bytes"] | undefined,
	dateTime: string,
	executionFeeBase?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote?: ModelTypes["BigDecimal"] | undefined
};
	["HistoryItemType"]:HistoryItemType;
	["HistoryItem_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	type?: ModelTypes["HistoryItemType"] | undefined,
	type_not?: ModelTypes["HistoryItemType"] | undefined,
	type_in?: Array<ModelTypes["HistoryItemType"]> | undefined,
	type_not_in?: Array<ModelTypes["HistoryItemType"]> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: ModelTypes["Position_filter"] | undefined,
	fillSize?: ModelTypes["BigDecimal"] | undefined,
	fillSize_not?: ModelTypes["BigDecimal"] | undefined,
	fillSize_gt?: ModelTypes["BigDecimal"] | undefined,
	fillSize_lt?: ModelTypes["BigDecimal"] | undefined,
	fillSize_gte?: ModelTypes["BigDecimal"] | undefined,
	fillSize_lte?: ModelTypes["BigDecimal"] | undefined,
	fillSize_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	fillSize_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	fillCost?: ModelTypes["BigDecimal"] | undefined,
	fillCost_not?: ModelTypes["BigDecimal"] | undefined,
	fillCost_gt?: ModelTypes["BigDecimal"] | undefined,
	fillCost_lt?: ModelTypes["BigDecimal"] | undefined,
	fillCost_gte?: ModelTypes["BigDecimal"] | undefined,
	fillCost_lte?: ModelTypes["BigDecimal"] | undefined,
	fillCost_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	fillCost_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	fillPrice?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_not?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_gt?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_lt?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_gte?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_lte?: ModelTypes["BigDecimal"] | undefined,
	fillPrice_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	fillPrice_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowCcy?: ModelTypes["Currency"] | undefined,
	cashflowCcy_not?: ModelTypes["Currency"] | undefined,
	cashflowCcy_in?: Array<ModelTypes["Currency"]> | undefined,
	cashflowCcy_not_in?: Array<ModelTypes["Currency"]> | undefined,
	cashflowBase?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuote?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBase?: ModelTypes["BigDecimal"] | undefined,
	equityBase_not?: ModelTypes["BigDecimal"] | undefined,
	equityBase_gt?: ModelTypes["BigDecimal"] | undefined,
	equityBase_lt?: ModelTypes["BigDecimal"] | undefined,
	equityBase_gte?: ModelTypes["BigDecimal"] | undefined,
	equityBase_lte?: ModelTypes["BigDecimal"] | undefined,
	equityBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuote?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_not?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	previousOpenQuantity?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_not?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_gt?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_lt?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_gte?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_lte?: ModelTypes["BigDecimal"] | undefined,
	previousOpenQuantity_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	previousOpenQuantity_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openQuantity?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_not?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_gt?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_lt?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_gte?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_lte?: ModelTypes["BigDecimal"] | undefined,
	openQuantity_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openQuantity_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	previousOpenCost?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_not?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_gt?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_lt?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_gte?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_lte?: ModelTypes["BigDecimal"] | undefined,
	previousOpenCost_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	previousOpenCost_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openCost?: ModelTypes["BigDecimal"] | undefined,
	openCost_not?: ModelTypes["BigDecimal"] | undefined,
	openCost_gt?: ModelTypes["BigDecimal"] | undefined,
	openCost_lt?: ModelTypes["BigDecimal"] | undefined,
	openCost_gte?: ModelTypes["BigDecimal"] | undefined,
	openCost_lte?: ModelTypes["BigDecimal"] | undefined,
	openCost_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openCost_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	closedCost?: ModelTypes["BigDecimal"] | undefined,
	closedCost_not?: ModelTypes["BigDecimal"] | undefined,
	closedCost_gt?: ModelTypes["BigDecimal"] | undefined,
	closedCost_lt?: ModelTypes["BigDecimal"] | undefined,
	closedCost_gte?: ModelTypes["BigDecimal"] | undefined,
	closedCost_lte?: ModelTypes["BigDecimal"] | undefined,
	closedCost_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	closedCost_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowBaseAcc?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowBaseAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuoteAcc?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuoteAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBaseAcc?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_not?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	equityBaseAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBaseAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuoteAcc?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_not?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	equityQuoteAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuoteAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeCcy?: ModelTypes["Currency"] | undefined,
	feeCcy_not?: ModelTypes["Currency"] | undefined,
	feeCcy_in?: Array<ModelTypes["Currency"]> | undefined,
	feeCcy_not_in?: Array<ModelTypes["Currency"]> | undefined,
	feeBase?: ModelTypes["BigDecimal"] | undefined,
	feeBase_not?: ModelTypes["BigDecimal"] | undefined,
	feeBase_gt?: ModelTypes["BigDecimal"] | undefined,
	feeBase_lt?: ModelTypes["BigDecimal"] | undefined,
	feeBase_gte?: ModelTypes["BigDecimal"] | undefined,
	feeBase_lte?: ModelTypes["BigDecimal"] | undefined,
	feeBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeQuote?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_not?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	feeQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeBaseAcc?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_not?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	feeBaseAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeBaseAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeQuoteAcc?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_not?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_gt?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_lt?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_gte?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_lte?: ModelTypes["BigDecimal"] | undefined,
	feeQuoteAcc_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feeQuoteAcc_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLBase?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_not?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_gt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_lt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_gte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_lte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLQuote?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_not?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	spotPrice?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_not?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_gt?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_lt?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_gte?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_lte?: ModelTypes["BigDecimal"] | undefined,
	spotPrice_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	spotPrice_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: ModelTypes["Account_filter"] | undefined,
	tradedBy?: string | undefined,
	tradedBy_not?: string | undefined,
	tradedBy_gt?: string | undefined,
	tradedBy_lt?: string | undefined,
	tradedBy_gte?: string | undefined,
	tradedBy_lte?: string | undefined,
	tradedBy_in?: Array<string> | undefined,
	tradedBy_not_in?: Array<string> | undefined,
	tradedBy_contains?: string | undefined,
	tradedBy_contains_nocase?: string | undefined,
	tradedBy_not_contains?: string | undefined,
	tradedBy_not_contains_nocase?: string | undefined,
	tradedBy_starts_with?: string | undefined,
	tradedBy_starts_with_nocase?: string | undefined,
	tradedBy_not_starts_with?: string | undefined,
	tradedBy_not_starts_with_nocase?: string | undefined,
	tradedBy_ends_with?: string | undefined,
	tradedBy_ends_with_nocase?: string | undefined,
	tradedBy_not_ends_with?: string | undefined,
	tradedBy_not_ends_with_nocase?: string | undefined,
	tradedBy_?: ModelTypes["Account_filter"] | undefined,
	blockNumber?: ModelTypes["BigInt"] | undefined,
	blockNumber_not?: ModelTypes["BigInt"] | undefined,
	blockNumber_gt?: ModelTypes["BigInt"] | undefined,
	blockNumber_lt?: ModelTypes["BigInt"] | undefined,
	blockNumber_gte?: ModelTypes["BigInt"] | undefined,
	blockNumber_lte?: ModelTypes["BigInt"] | undefined,
	blockNumber_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockNumber_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockTimestamp?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_not?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_gt?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_lt?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_gte?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_lte?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockTimestamp_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	transactionHash?: ModelTypes["Bytes"] | undefined,
	transactionHash_not?: ModelTypes["Bytes"] | undefined,
	transactionHash_gt?: ModelTypes["Bytes"] | undefined,
	transactionHash_lt?: ModelTypes["Bytes"] | undefined,
	transactionHash_gte?: ModelTypes["Bytes"] | undefined,
	transactionHash_lte?: ModelTypes["Bytes"] | undefined,
	transactionHash_in?: Array<ModelTypes["Bytes"]> | undefined,
	transactionHash_not_in?: Array<ModelTypes["Bytes"]> | undefined,
	transactionHash_contains?: ModelTypes["Bytes"] | undefined,
	transactionHash_not_contains?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_not?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_gt?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_lt?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_gte?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_lte?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_in?: Array<ModelTypes["Bytes"]> | undefined,
	prevTransactionHash_not_in?: Array<ModelTypes["Bytes"]> | undefined,
	prevTransactionHash_contains?: ModelTypes["Bytes"] | undefined,
	prevTransactionHash_not_contains?: ModelTypes["Bytes"] | undefined,
	dateTime?: string | undefined,
	dateTime_not?: string | undefined,
	dateTime_gt?: string | undefined,
	dateTime_lt?: string | undefined,
	dateTime_gte?: string | undefined,
	dateTime_lte?: string | undefined,
	dateTime_in?: Array<string> | undefined,
	dateTime_not_in?: Array<string> | undefined,
	dateTime_contains?: string | undefined,
	dateTime_contains_nocase?: string | undefined,
	dateTime_not_contains?: string | undefined,
	dateTime_not_contains_nocase?: string | undefined,
	dateTime_starts_with?: string | undefined,
	dateTime_starts_with_nocase?: string | undefined,
	dateTime_not_starts_with?: string | undefined,
	dateTime_not_starts_with_nocase?: string | undefined,
	dateTime_ends_with?: string | undefined,
	dateTime_ends_with_nocase?: string | undefined,
	dateTime_not_ends_with?: string | undefined,
	dateTime_not_ends_with_nocase?: string | undefined,
	executionFeeBase?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_not?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_gt?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_lt?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_gte?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_lte?: ModelTypes["BigDecimal"] | undefined,
	executionFeeBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	executionFeeBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	executionFeeQuote?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_not?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	executionFeeQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	executionFeeQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenalty?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_not?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_gt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_lt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_gte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_lte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenalty_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenalty_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenaltyBase?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_not?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_gt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_lt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_gte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_lte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenaltyBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenaltyQuote?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_not?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	liquidationPenaltyQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["HistoryItem_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["HistoryItem_filter"] | undefined> | undefined
};
	["HistoryItem_orderBy"]:HistoryItem_orderBy;
	["Instrument"]: {
		id: string,
	symbol: string,
	base: ModelTypes["Asset"],
	quote: ModelTypes["Asset"],
	positions: Array<ModelTypes["Position"]>,
	orders: Array<ModelTypes["Order"]>
};
	["InstrumentTotal"]: {
		id: string,
	symbol: string,
	openInterest: ModelTypes["BigDecimal"],
	totalVolume: ModelTypes["BigDecimal"],
	totalFees: ModelTypes["BigDecimal"],
	openPositions: ModelTypes["BigInt"],
	totalPositions: ModelTypes["BigInt"]
};
	["InstrumentTotal_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	openInterest?: ModelTypes["BigDecimal"] | undefined,
	openInterest_not?: ModelTypes["BigDecimal"] | undefined,
	openInterest_gt?: ModelTypes["BigDecimal"] | undefined,
	openInterest_lt?: ModelTypes["BigDecimal"] | undefined,
	openInterest_gte?: ModelTypes["BigDecimal"] | undefined,
	openInterest_lte?: ModelTypes["BigDecimal"] | undefined,
	openInterest_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openInterest_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalVolume?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_not?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_gt?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_lt?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_gte?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_lte?: ModelTypes["BigDecimal"] | undefined,
	totalVolume_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalVolume_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalFees?: ModelTypes["BigDecimal"] | undefined,
	totalFees_not?: ModelTypes["BigDecimal"] | undefined,
	totalFees_gt?: ModelTypes["BigDecimal"] | undefined,
	totalFees_lt?: ModelTypes["BigDecimal"] | undefined,
	totalFees_gte?: ModelTypes["BigDecimal"] | undefined,
	totalFees_lte?: ModelTypes["BigDecimal"] | undefined,
	totalFees_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	totalFees_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openPositions?: ModelTypes["BigInt"] | undefined,
	openPositions_not?: ModelTypes["BigInt"] | undefined,
	openPositions_gt?: ModelTypes["BigInt"] | undefined,
	openPositions_lt?: ModelTypes["BigInt"] | undefined,
	openPositions_gte?: ModelTypes["BigInt"] | undefined,
	openPositions_lte?: ModelTypes["BigInt"] | undefined,
	openPositions_in?: Array<ModelTypes["BigInt"]> | undefined,
	openPositions_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	totalPositions?: ModelTypes["BigInt"] | undefined,
	totalPositions_not?: ModelTypes["BigInt"] | undefined,
	totalPositions_gt?: ModelTypes["BigInt"] | undefined,
	totalPositions_lt?: ModelTypes["BigInt"] | undefined,
	totalPositions_gte?: ModelTypes["BigInt"] | undefined,
	totalPositions_lte?: ModelTypes["BigInt"] | undefined,
	totalPositions_in?: Array<ModelTypes["BigInt"]> | undefined,
	totalPositions_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["InstrumentTotal_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["InstrumentTotal_filter"] | undefined> | undefined
};
	["InstrumentTotal_orderBy"]:InstrumentTotal_orderBy;
	["Instrument_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	base?: string | undefined,
	base_not?: string | undefined,
	base_gt?: string | undefined,
	base_lt?: string | undefined,
	base_gte?: string | undefined,
	base_lte?: string | undefined,
	base_in?: Array<string> | undefined,
	base_not_in?: Array<string> | undefined,
	base_contains?: string | undefined,
	base_contains_nocase?: string | undefined,
	base_not_contains?: string | undefined,
	base_not_contains_nocase?: string | undefined,
	base_starts_with?: string | undefined,
	base_starts_with_nocase?: string | undefined,
	base_not_starts_with?: string | undefined,
	base_not_starts_with_nocase?: string | undefined,
	base_ends_with?: string | undefined,
	base_ends_with_nocase?: string | undefined,
	base_not_ends_with?: string | undefined,
	base_not_ends_with_nocase?: string | undefined,
	base_?: ModelTypes["Asset_filter"] | undefined,
	quote?: string | undefined,
	quote_not?: string | undefined,
	quote_gt?: string | undefined,
	quote_lt?: string | undefined,
	quote_gte?: string | undefined,
	quote_lte?: string | undefined,
	quote_in?: Array<string> | undefined,
	quote_not_in?: Array<string> | undefined,
	quote_contains?: string | undefined,
	quote_contains_nocase?: string | undefined,
	quote_not_contains?: string | undefined,
	quote_not_contains_nocase?: string | undefined,
	quote_starts_with?: string | undefined,
	quote_starts_with_nocase?: string | undefined,
	quote_not_starts_with?: string | undefined,
	quote_not_starts_with_nocase?: string | undefined,
	quote_ends_with?: string | undefined,
	quote_ends_with_nocase?: string | undefined,
	quote_not_ends_with?: string | undefined,
	quote_not_ends_with_nocase?: string | undefined,
	quote_?: ModelTypes["Asset_filter"] | undefined,
	positions_?: ModelTypes["Position_filter"] | undefined,
	orders_?: ModelTypes["Order_filter"] | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["Instrument_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["Instrument_filter"] | undefined> | undefined
};
	["Instrument_orderBy"]:Instrument_orderBy;
	/** 8 bytes signed integer */
["Int8"]:any;
	["MoneyMarket"]:MoneyMarket;
	["Order"]: {
		id: string,
	position?: ModelTypes["Position"] | undefined,
	instrument: ModelTypes["Instrument"],
	owner: ModelTypes["Account"],
	side: ModelTypes["Side"],
	type: ModelTypes["OrderType"],
	quantity: ModelTypes["BigInt"],
	limitPrice: ModelTypes["BigInt"],
	tolerance?: ModelTypes["BigInt"] | undefined,
	cashflow: ModelTypes["BigInt"],
	cashflowCcy: ModelTypes["Currency"],
	deadline: ModelTypes["BigInt"],
	placedBy: ModelTypes["Account"],
	blockNumber: ModelTypes["BigInt"],
	blockTimestamp: ModelTypes["BigInt"],
	dateTime: string
};
	["OrderDirection"]:OrderDirection;
	["OrderType"]:OrderType;
	["Order_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: ModelTypes["Position_filter"] | undefined,
	instrument?: string | undefined,
	instrument_not?: string | undefined,
	instrument_gt?: string | undefined,
	instrument_lt?: string | undefined,
	instrument_gte?: string | undefined,
	instrument_lte?: string | undefined,
	instrument_in?: Array<string> | undefined,
	instrument_not_in?: Array<string> | undefined,
	instrument_contains?: string | undefined,
	instrument_contains_nocase?: string | undefined,
	instrument_not_contains?: string | undefined,
	instrument_not_contains_nocase?: string | undefined,
	instrument_starts_with?: string | undefined,
	instrument_starts_with_nocase?: string | undefined,
	instrument_not_starts_with?: string | undefined,
	instrument_not_starts_with_nocase?: string | undefined,
	instrument_ends_with?: string | undefined,
	instrument_ends_with_nocase?: string | undefined,
	instrument_not_ends_with?: string | undefined,
	instrument_not_ends_with_nocase?: string | undefined,
	instrument_?: ModelTypes["Instrument_filter"] | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: ModelTypes["Account_filter"] | undefined,
	side?: ModelTypes["Side"] | undefined,
	side_not?: ModelTypes["Side"] | undefined,
	side_in?: Array<ModelTypes["Side"]> | undefined,
	side_not_in?: Array<ModelTypes["Side"]> | undefined,
	type?: ModelTypes["OrderType"] | undefined,
	type_not?: ModelTypes["OrderType"] | undefined,
	type_in?: Array<ModelTypes["OrderType"]> | undefined,
	type_not_in?: Array<ModelTypes["OrderType"]> | undefined,
	quantity?: ModelTypes["BigInt"] | undefined,
	quantity_not?: ModelTypes["BigInt"] | undefined,
	quantity_gt?: ModelTypes["BigInt"] | undefined,
	quantity_lt?: ModelTypes["BigInt"] | undefined,
	quantity_gte?: ModelTypes["BigInt"] | undefined,
	quantity_lte?: ModelTypes["BigInt"] | undefined,
	quantity_in?: Array<ModelTypes["BigInt"]> | undefined,
	quantity_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	limitPrice?: ModelTypes["BigInt"] | undefined,
	limitPrice_not?: ModelTypes["BigInt"] | undefined,
	limitPrice_gt?: ModelTypes["BigInt"] | undefined,
	limitPrice_lt?: ModelTypes["BigInt"] | undefined,
	limitPrice_gte?: ModelTypes["BigInt"] | undefined,
	limitPrice_lte?: ModelTypes["BigInt"] | undefined,
	limitPrice_in?: Array<ModelTypes["BigInt"]> | undefined,
	limitPrice_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	tolerance?: ModelTypes["BigInt"] | undefined,
	tolerance_not?: ModelTypes["BigInt"] | undefined,
	tolerance_gt?: ModelTypes["BigInt"] | undefined,
	tolerance_lt?: ModelTypes["BigInt"] | undefined,
	tolerance_gte?: ModelTypes["BigInt"] | undefined,
	tolerance_lte?: ModelTypes["BigInt"] | undefined,
	tolerance_in?: Array<ModelTypes["BigInt"]> | undefined,
	tolerance_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	cashflow?: ModelTypes["BigInt"] | undefined,
	cashflow_not?: ModelTypes["BigInt"] | undefined,
	cashflow_gt?: ModelTypes["BigInt"] | undefined,
	cashflow_lt?: ModelTypes["BigInt"] | undefined,
	cashflow_gte?: ModelTypes["BigInt"] | undefined,
	cashflow_lte?: ModelTypes["BigInt"] | undefined,
	cashflow_in?: Array<ModelTypes["BigInt"]> | undefined,
	cashflow_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	cashflowCcy?: ModelTypes["Currency"] | undefined,
	cashflowCcy_not?: ModelTypes["Currency"] | undefined,
	cashflowCcy_in?: Array<ModelTypes["Currency"]> | undefined,
	cashflowCcy_not_in?: Array<ModelTypes["Currency"]> | undefined,
	deadline?: ModelTypes["BigInt"] | undefined,
	deadline_not?: ModelTypes["BigInt"] | undefined,
	deadline_gt?: ModelTypes["BigInt"] | undefined,
	deadline_lt?: ModelTypes["BigInt"] | undefined,
	deadline_gte?: ModelTypes["BigInt"] | undefined,
	deadline_lte?: ModelTypes["BigInt"] | undefined,
	deadline_in?: Array<ModelTypes["BigInt"]> | undefined,
	deadline_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	placedBy?: string | undefined,
	placedBy_not?: string | undefined,
	placedBy_gt?: string | undefined,
	placedBy_lt?: string | undefined,
	placedBy_gte?: string | undefined,
	placedBy_lte?: string | undefined,
	placedBy_in?: Array<string> | undefined,
	placedBy_not_in?: Array<string> | undefined,
	placedBy_contains?: string | undefined,
	placedBy_contains_nocase?: string | undefined,
	placedBy_not_contains?: string | undefined,
	placedBy_not_contains_nocase?: string | undefined,
	placedBy_starts_with?: string | undefined,
	placedBy_starts_with_nocase?: string | undefined,
	placedBy_not_starts_with?: string | undefined,
	placedBy_not_starts_with_nocase?: string | undefined,
	placedBy_ends_with?: string | undefined,
	placedBy_ends_with_nocase?: string | undefined,
	placedBy_not_ends_with?: string | undefined,
	placedBy_not_ends_with_nocase?: string | undefined,
	placedBy_?: ModelTypes["Account_filter"] | undefined,
	blockNumber?: ModelTypes["BigInt"] | undefined,
	blockNumber_not?: ModelTypes["BigInt"] | undefined,
	blockNumber_gt?: ModelTypes["BigInt"] | undefined,
	blockNumber_lt?: ModelTypes["BigInt"] | undefined,
	blockNumber_gte?: ModelTypes["BigInt"] | undefined,
	blockNumber_lte?: ModelTypes["BigInt"] | undefined,
	blockNumber_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockNumber_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockTimestamp?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_not?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_gt?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_lt?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_gte?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_lte?: ModelTypes["BigInt"] | undefined,
	blockTimestamp_in?: Array<ModelTypes["BigInt"]> | undefined,
	blockTimestamp_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	dateTime?: string | undefined,
	dateTime_not?: string | undefined,
	dateTime_gt?: string | undefined,
	dateTime_lt?: string | undefined,
	dateTime_gte?: string | undefined,
	dateTime_lte?: string | undefined,
	dateTime_in?: Array<string> | undefined,
	dateTime_not_in?: Array<string> | undefined,
	dateTime_contains?: string | undefined,
	dateTime_contains_nocase?: string | undefined,
	dateTime_not_contains?: string | undefined,
	dateTime_not_contains_nocase?: string | undefined,
	dateTime_starts_with?: string | undefined,
	dateTime_starts_with_nocase?: string | undefined,
	dateTime_not_starts_with?: string | undefined,
	dateTime_not_starts_with_nocase?: string | undefined,
	dateTime_ends_with?: string | undefined,
	dateTime_ends_with_nocase?: string | undefined,
	dateTime_not_ends_with?: string | undefined,
	dateTime_not_ends_with_nocase?: string | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["Order_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["Order_filter"] | undefined> | undefined
};
	["Order_orderBy"]:Order_orderBy;
	["Position"]: {
		id: string,
	instrument: ModelTypes["Instrument"],
	owner: ModelTypes["Account"],
	moneyMarket: ModelTypes["MoneyMarket"],
	number: ModelTypes["BigInt"],
	expiry: ModelTypes["BigInt"],
	quantity: ModelTypes["BigDecimal"],
	openCost: ModelTypes["BigDecimal"],
	feesBase: ModelTypes["BigDecimal"],
	feesQuote: ModelTypes["BigDecimal"],
	realisedPnLBase: ModelTypes["BigDecimal"],
	realisedPnLQuote: ModelTypes["BigDecimal"],
	cashflowBase: ModelTypes["BigDecimal"],
	cashflowQuote: ModelTypes["BigDecimal"],
	equityBase: ModelTypes["BigDecimal"],
	equityQuote: ModelTypes["BigDecimal"],
	history: Array<ModelTypes["HistoryItem"]>,
	orders: Array<ModelTypes["Order"]>,
	latestTransactionHash?: ModelTypes["Bytes"] | undefined,
	creationBlockNumber: ModelTypes["BigInt"],
	creationBlockTimestamp: ModelTypes["BigInt"],
	creationTransactionHash: ModelTypes["Bytes"],
	creationDateTime: string,
	claimableRewards: boolean
};
	["Position_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	instrument?: string | undefined,
	instrument_not?: string | undefined,
	instrument_gt?: string | undefined,
	instrument_lt?: string | undefined,
	instrument_gte?: string | undefined,
	instrument_lte?: string | undefined,
	instrument_in?: Array<string> | undefined,
	instrument_not_in?: Array<string> | undefined,
	instrument_contains?: string | undefined,
	instrument_contains_nocase?: string | undefined,
	instrument_not_contains?: string | undefined,
	instrument_not_contains_nocase?: string | undefined,
	instrument_starts_with?: string | undefined,
	instrument_starts_with_nocase?: string | undefined,
	instrument_not_starts_with?: string | undefined,
	instrument_not_starts_with_nocase?: string | undefined,
	instrument_ends_with?: string | undefined,
	instrument_ends_with_nocase?: string | undefined,
	instrument_not_ends_with?: string | undefined,
	instrument_not_ends_with_nocase?: string | undefined,
	instrument_?: ModelTypes["Instrument_filter"] | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: ModelTypes["Account_filter"] | undefined,
	moneyMarket?: ModelTypes["MoneyMarket"] | undefined,
	moneyMarket_not?: ModelTypes["MoneyMarket"] | undefined,
	moneyMarket_in?: Array<ModelTypes["MoneyMarket"]> | undefined,
	moneyMarket_not_in?: Array<ModelTypes["MoneyMarket"]> | undefined,
	number?: ModelTypes["BigInt"] | undefined,
	number_not?: ModelTypes["BigInt"] | undefined,
	number_gt?: ModelTypes["BigInt"] | undefined,
	number_lt?: ModelTypes["BigInt"] | undefined,
	number_gte?: ModelTypes["BigInt"] | undefined,
	number_lte?: ModelTypes["BigInt"] | undefined,
	number_in?: Array<ModelTypes["BigInt"]> | undefined,
	number_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	expiry?: ModelTypes["BigInt"] | undefined,
	expiry_not?: ModelTypes["BigInt"] | undefined,
	expiry_gt?: ModelTypes["BigInt"] | undefined,
	expiry_lt?: ModelTypes["BigInt"] | undefined,
	expiry_gte?: ModelTypes["BigInt"] | undefined,
	expiry_lte?: ModelTypes["BigInt"] | undefined,
	expiry_in?: Array<ModelTypes["BigInt"]> | undefined,
	expiry_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	quantity?: ModelTypes["BigDecimal"] | undefined,
	quantity_not?: ModelTypes["BigDecimal"] | undefined,
	quantity_gt?: ModelTypes["BigDecimal"] | undefined,
	quantity_lt?: ModelTypes["BigDecimal"] | undefined,
	quantity_gte?: ModelTypes["BigDecimal"] | undefined,
	quantity_lte?: ModelTypes["BigDecimal"] | undefined,
	quantity_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	quantity_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openCost?: ModelTypes["BigDecimal"] | undefined,
	openCost_not?: ModelTypes["BigDecimal"] | undefined,
	openCost_gt?: ModelTypes["BigDecimal"] | undefined,
	openCost_lt?: ModelTypes["BigDecimal"] | undefined,
	openCost_gte?: ModelTypes["BigDecimal"] | undefined,
	openCost_lte?: ModelTypes["BigDecimal"] | undefined,
	openCost_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	openCost_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feesBase?: ModelTypes["BigDecimal"] | undefined,
	feesBase_not?: ModelTypes["BigDecimal"] | undefined,
	feesBase_gt?: ModelTypes["BigDecimal"] | undefined,
	feesBase_lt?: ModelTypes["BigDecimal"] | undefined,
	feesBase_gte?: ModelTypes["BigDecimal"] | undefined,
	feesBase_lte?: ModelTypes["BigDecimal"] | undefined,
	feesBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feesBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feesQuote?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_not?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	feesQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	feesQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLBase?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_not?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_gt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_lt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_gte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_lte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLQuote?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_not?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	realisedPnLQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	realisedPnLQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowBase?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuote?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_not?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	cashflowQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	cashflowQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBase?: ModelTypes["BigDecimal"] | undefined,
	equityBase_not?: ModelTypes["BigDecimal"] | undefined,
	equityBase_gt?: ModelTypes["BigDecimal"] | undefined,
	equityBase_lt?: ModelTypes["BigDecimal"] | undefined,
	equityBase_gte?: ModelTypes["BigDecimal"] | undefined,
	equityBase_lte?: ModelTypes["BigDecimal"] | undefined,
	equityBase_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityBase_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuote?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_not?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_gt?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_lt?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_gte?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_lte?: ModelTypes["BigDecimal"] | undefined,
	equityQuote_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	equityQuote_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	history_?: ModelTypes["HistoryItem_filter"] | undefined,
	orders_?: ModelTypes["Order_filter"] | undefined,
	latestTransactionHash?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_not?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_gt?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_lt?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_gte?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_lte?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_in?: Array<ModelTypes["Bytes"]> | undefined,
	latestTransactionHash_not_in?: Array<ModelTypes["Bytes"]> | undefined,
	latestTransactionHash_contains?: ModelTypes["Bytes"] | undefined,
	latestTransactionHash_not_contains?: ModelTypes["Bytes"] | undefined,
	creationBlockNumber?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_not?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_gt?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_lt?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_gte?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_lte?: ModelTypes["BigInt"] | undefined,
	creationBlockNumber_in?: Array<ModelTypes["BigInt"]> | undefined,
	creationBlockNumber_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	creationBlockTimestamp?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_not?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_gt?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_lt?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_gte?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_lte?: ModelTypes["BigInt"] | undefined,
	creationBlockTimestamp_in?: Array<ModelTypes["BigInt"]> | undefined,
	creationBlockTimestamp_not_in?: Array<ModelTypes["BigInt"]> | undefined,
	creationTransactionHash?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_not?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_gt?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_lt?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_gte?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_lte?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_in?: Array<ModelTypes["Bytes"]> | undefined,
	creationTransactionHash_not_in?: Array<ModelTypes["Bytes"]> | undefined,
	creationTransactionHash_contains?: ModelTypes["Bytes"] | undefined,
	creationTransactionHash_not_contains?: ModelTypes["Bytes"] | undefined,
	creationDateTime?: string | undefined,
	creationDateTime_not?: string | undefined,
	creationDateTime_gt?: string | undefined,
	creationDateTime_lt?: string | undefined,
	creationDateTime_gte?: string | undefined,
	creationDateTime_lte?: string | undefined,
	creationDateTime_in?: Array<string> | undefined,
	creationDateTime_not_in?: Array<string> | undefined,
	creationDateTime_contains?: string | undefined,
	creationDateTime_contains_nocase?: string | undefined,
	creationDateTime_not_contains?: string | undefined,
	creationDateTime_not_contains_nocase?: string | undefined,
	creationDateTime_starts_with?: string | undefined,
	creationDateTime_starts_with_nocase?: string | undefined,
	creationDateTime_not_starts_with?: string | undefined,
	creationDateTime_not_starts_with_nocase?: string | undefined,
	creationDateTime_ends_with?: string | undefined,
	creationDateTime_ends_with_nocase?: string | undefined,
	creationDateTime_not_ends_with?: string | undefined,
	creationDateTime_not_ends_with_nocase?: string | undefined,
	claimableRewards?: boolean | undefined,
	claimableRewards_not?: boolean | undefined,
	claimableRewards_in?: Array<boolean> | undefined,
	claimableRewards_not_in?: Array<boolean> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["Position_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["Position_filter"] | undefined> | undefined
};
	["Position_orderBy"]:Position_orderBy;
	["Query"]: {
		asset?: ModelTypes["Asset"] | undefined,
	assets: Array<ModelTypes["Asset"]>,
	assetTotal?: ModelTypes["AssetTotal"] | undefined,
	assetTotals: Array<ModelTypes["AssetTotal"]>,
	instrument?: ModelTypes["Instrument"] | undefined,
	instruments: Array<ModelTypes["Instrument"]>,
	instrumentTotal?: ModelTypes["InstrumentTotal"] | undefined,
	instrumentTotals: Array<ModelTypes["InstrumentTotal"]>,
	underlyingPosition?: ModelTypes["UnderlyingPosition"] | undefined,
	underlyingPositions: Array<ModelTypes["UnderlyingPosition"]>,
	account?: ModelTypes["Account"] | undefined,
	accounts: Array<ModelTypes["Account"]>,
	referralCounter?: ModelTypes["ReferralCounter"] | undefined,
	referralCounters: Array<ModelTypes["ReferralCounter"]>,
	position?: ModelTypes["Position"] | undefined,
	positions: Array<ModelTypes["Position"]>,
	historyItem?: ModelTypes["HistoryItem"] | undefined,
	historyItems: Array<ModelTypes["HistoryItem"]>,
	order?: ModelTypes["Order"] | undefined,
	orders: Array<ModelTypes["Order"]>,
	/** Access to subgraph metadata */
	_meta?: ModelTypes["_Meta_"] | undefined
};
	["ReferralCounter"]: {
		id: string,
	account: ModelTypes["Account"],
	asset: ModelTypes["Asset"],
	rebates: ModelTypes["BigDecimal"],
	rewards: ModelTypes["BigDecimal"]
};
	["ReferralCounter_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	account?: string | undefined,
	account_not?: string | undefined,
	account_gt?: string | undefined,
	account_lt?: string | undefined,
	account_gte?: string | undefined,
	account_lte?: string | undefined,
	account_in?: Array<string> | undefined,
	account_not_in?: Array<string> | undefined,
	account_contains?: string | undefined,
	account_contains_nocase?: string | undefined,
	account_not_contains?: string | undefined,
	account_not_contains_nocase?: string | undefined,
	account_starts_with?: string | undefined,
	account_starts_with_nocase?: string | undefined,
	account_not_starts_with?: string | undefined,
	account_not_starts_with_nocase?: string | undefined,
	account_ends_with?: string | undefined,
	account_ends_with_nocase?: string | undefined,
	account_not_ends_with?: string | undefined,
	account_not_ends_with_nocase?: string | undefined,
	account_?: ModelTypes["Account_filter"] | undefined,
	asset?: string | undefined,
	asset_not?: string | undefined,
	asset_gt?: string | undefined,
	asset_lt?: string | undefined,
	asset_gte?: string | undefined,
	asset_lte?: string | undefined,
	asset_in?: Array<string> | undefined,
	asset_not_in?: Array<string> | undefined,
	asset_contains?: string | undefined,
	asset_contains_nocase?: string | undefined,
	asset_not_contains?: string | undefined,
	asset_not_contains_nocase?: string | undefined,
	asset_starts_with?: string | undefined,
	asset_starts_with_nocase?: string | undefined,
	asset_not_starts_with?: string | undefined,
	asset_not_starts_with_nocase?: string | undefined,
	asset_ends_with?: string | undefined,
	asset_ends_with_nocase?: string | undefined,
	asset_not_ends_with?: string | undefined,
	asset_not_ends_with_nocase?: string | undefined,
	asset_?: ModelTypes["Asset_filter"] | undefined,
	rebates?: ModelTypes["BigDecimal"] | undefined,
	rebates_not?: ModelTypes["BigDecimal"] | undefined,
	rebates_gt?: ModelTypes["BigDecimal"] | undefined,
	rebates_lt?: ModelTypes["BigDecimal"] | undefined,
	rebates_gte?: ModelTypes["BigDecimal"] | undefined,
	rebates_lte?: ModelTypes["BigDecimal"] | undefined,
	rebates_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	rebates_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	rewards?: ModelTypes["BigDecimal"] | undefined,
	rewards_not?: ModelTypes["BigDecimal"] | undefined,
	rewards_gt?: ModelTypes["BigDecimal"] | undefined,
	rewards_lt?: ModelTypes["BigDecimal"] | undefined,
	rewards_gte?: ModelTypes["BigDecimal"] | undefined,
	rewards_lte?: ModelTypes["BigDecimal"] | undefined,
	rewards_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	rewards_not_in?: Array<ModelTypes["BigDecimal"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["ReferralCounter_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["ReferralCounter_filter"] | undefined> | undefined
};
	["ReferralCounter_orderBy"]:ReferralCounter_orderBy;
	["Side"]:Side;
	["Subscription"]: {
		asset?: ModelTypes["Asset"] | undefined,
	assets: Array<ModelTypes["Asset"]>,
	assetTotal?: ModelTypes["AssetTotal"] | undefined,
	assetTotals: Array<ModelTypes["AssetTotal"]>,
	instrument?: ModelTypes["Instrument"] | undefined,
	instruments: Array<ModelTypes["Instrument"]>,
	instrumentTotal?: ModelTypes["InstrumentTotal"] | undefined,
	instrumentTotals: Array<ModelTypes["InstrumentTotal"]>,
	underlyingPosition?: ModelTypes["UnderlyingPosition"] | undefined,
	underlyingPositions: Array<ModelTypes["UnderlyingPosition"]>,
	account?: ModelTypes["Account"] | undefined,
	accounts: Array<ModelTypes["Account"]>,
	referralCounter?: ModelTypes["ReferralCounter"] | undefined,
	referralCounters: Array<ModelTypes["ReferralCounter"]>,
	position?: ModelTypes["Position"] | undefined,
	positions: Array<ModelTypes["Position"]>,
	historyItem?: ModelTypes["HistoryItem"] | undefined,
	historyItems: Array<ModelTypes["HistoryItem"]>,
	order?: ModelTypes["Order"] | undefined,
	orders: Array<ModelTypes["Order"]>,
	/** Access to subgraph metadata */
	_meta?: ModelTypes["_Meta_"] | undefined
};
	["UnderlyingPosition"]: {
		id: string,
	position: ModelTypes["Position"]
};
	["UnderlyingPosition_filter"]: {
	id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: ModelTypes["Position_filter"] | undefined,
	/** Filter for the block changed event. */
	_change_block?: ModelTypes["BlockChangedFilter"] | undefined,
	and?: Array<ModelTypes["UnderlyingPosition_filter"] | undefined> | undefined,
	or?: Array<ModelTypes["UnderlyingPosition_filter"] | undefined> | undefined
};
	["UnderlyingPosition_orderBy"]:UnderlyingPosition_orderBy;
	["_Block_"]: {
		/** The hash of the block */
	hash?: ModelTypes["Bytes"] | undefined,
	/** The block number */
	number: number,
	/** Integer representation of the timestamp stored in blocks for the chain */
	timestamp?: number | undefined
};
	/** The type for the top-level _meta field */
["_Meta_"]: {
		/** Information about a specific subgraph block. The hash of the block
will be null if the _meta field has a block constraint that asks for
a block number. It will be filled if the _meta field has no block constraint
and therefore asks for the latest  block */
	block: ModelTypes["_Block_"],
	/** The deployment ID */
	deployment: string,
	/** If `true`, the subgraph encountered indexing errors at some past block */
	hasIndexingErrors: boolean
};
	["_SubgraphErrorPolicy_"]:_SubgraphErrorPolicy_;
	["schema"]: {
	query?: ModelTypes["Query"] | undefined,
	subscription?: ModelTypes["Subscription"] | undefined
}
    }

export type GraphQLTypes = {
    ["Account"]: {
	__typename: "Account",
	id: string,
	positions: Array<GraphQLTypes["Position"]>,
	orders: Array<GraphQLTypes["Order"]>,
	referralCounters: Array<GraphQLTypes["ReferralCounter"]>,
	referralCode?: string | undefined,
	referredByCode?: string | undefined
};
	["Account_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	positions_?: GraphQLTypes["Position_filter"] | undefined,
	orders_?: GraphQLTypes["Order_filter"] | undefined,
	referralCounters_?: GraphQLTypes["ReferralCounter_filter"] | undefined,
	referralCode?: string | undefined,
	referralCode_not?: string | undefined,
	referralCode_gt?: string | undefined,
	referralCode_lt?: string | undefined,
	referralCode_gte?: string | undefined,
	referralCode_lte?: string | undefined,
	referralCode_in?: Array<string> | undefined,
	referralCode_not_in?: Array<string> | undefined,
	referralCode_contains?: string | undefined,
	referralCode_contains_nocase?: string | undefined,
	referralCode_not_contains?: string | undefined,
	referralCode_not_contains_nocase?: string | undefined,
	referralCode_starts_with?: string | undefined,
	referralCode_starts_with_nocase?: string | undefined,
	referralCode_not_starts_with?: string | undefined,
	referralCode_not_starts_with_nocase?: string | undefined,
	referralCode_ends_with?: string | undefined,
	referralCode_ends_with_nocase?: string | undefined,
	referralCode_not_ends_with?: string | undefined,
	referralCode_not_ends_with_nocase?: string | undefined,
	referredByCode?: string | undefined,
	referredByCode_not?: string | undefined,
	referredByCode_gt?: string | undefined,
	referredByCode_lt?: string | undefined,
	referredByCode_gte?: string | undefined,
	referredByCode_lte?: string | undefined,
	referredByCode_in?: Array<string> | undefined,
	referredByCode_not_in?: Array<string> | undefined,
	referredByCode_contains?: string | undefined,
	referredByCode_contains_nocase?: string | undefined,
	referredByCode_not_contains?: string | undefined,
	referredByCode_not_contains_nocase?: string | undefined,
	referredByCode_starts_with?: string | undefined,
	referredByCode_starts_with_nocase?: string | undefined,
	referredByCode_not_starts_with?: string | undefined,
	referredByCode_not_starts_with_nocase?: string | undefined,
	referredByCode_ends_with?: string | undefined,
	referredByCode_ends_with_nocase?: string | undefined,
	referredByCode_not_ends_with?: string | undefined,
	referredByCode_not_ends_with_nocase?: string | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["Account_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["Account_filter"] | undefined> | undefined
};
	["Account_orderBy"]: Account_orderBy;
	["Asset"]: {
	__typename: "Asset",
	id: string,
	name: string,
	symbol: string,
	decimals: number
};
	["AssetTotal"]: {
	__typename: "AssetTotal",
	id: string,
	symbol: string,
	openInterest: GraphQLTypes["BigDecimal"],
	totalVolume: GraphQLTypes["BigDecimal"],
	totalFees: GraphQLTypes["BigDecimal"],
	openPositions: GraphQLTypes["BigInt"],
	totalPositions: GraphQLTypes["BigInt"]
};
	["AssetTotal_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	openInterest?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_not?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_gt?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_lt?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_gte?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_lte?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openInterest_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalVolume?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_not?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_gt?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_lt?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_gte?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_lte?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalVolume_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalFees?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_not?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_gt?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_lt?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_gte?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_lte?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalFees_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openPositions?: GraphQLTypes["BigInt"] | undefined,
	openPositions_not?: GraphQLTypes["BigInt"] | undefined,
	openPositions_gt?: GraphQLTypes["BigInt"] | undefined,
	openPositions_lt?: GraphQLTypes["BigInt"] | undefined,
	openPositions_gte?: GraphQLTypes["BigInt"] | undefined,
	openPositions_lte?: GraphQLTypes["BigInt"] | undefined,
	openPositions_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	openPositions_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	totalPositions?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_not?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_gt?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_lt?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_gte?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_lte?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	totalPositions_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["AssetTotal_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["AssetTotal_filter"] | undefined> | undefined
};
	["AssetTotal_orderBy"]: AssetTotal_orderBy;
	["Asset_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	name?: string | undefined,
	name_not?: string | undefined,
	name_gt?: string | undefined,
	name_lt?: string | undefined,
	name_gte?: string | undefined,
	name_lte?: string | undefined,
	name_in?: Array<string> | undefined,
	name_not_in?: Array<string> | undefined,
	name_contains?: string | undefined,
	name_contains_nocase?: string | undefined,
	name_not_contains?: string | undefined,
	name_not_contains_nocase?: string | undefined,
	name_starts_with?: string | undefined,
	name_starts_with_nocase?: string | undefined,
	name_not_starts_with?: string | undefined,
	name_not_starts_with_nocase?: string | undefined,
	name_ends_with?: string | undefined,
	name_ends_with_nocase?: string | undefined,
	name_not_ends_with?: string | undefined,
	name_not_ends_with_nocase?: string | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	decimals?: number | undefined,
	decimals_not?: number | undefined,
	decimals_gt?: number | undefined,
	decimals_lt?: number | undefined,
	decimals_gte?: number | undefined,
	decimals_lte?: number | undefined,
	decimals_in?: Array<number> | undefined,
	decimals_not_in?: Array<number> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["Asset_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["Asset_filter"] | undefined> | undefined
};
	["Asset_orderBy"]: Asset_orderBy;
	["BigDecimal"]: "scalar" & { name: "BigDecimal" };
	["BigInt"]: "scalar" & { name: "BigInt" };
	["BlockChangedFilter"]: {
		number_gte: number
};
	["Block_height"]: {
		hash?: GraphQLTypes["Bytes"] | undefined,
	number?: number | undefined,
	number_gte?: number | undefined
};
	["Bytes"]: "scalar" & { name: "Bytes" };
	["Currency"]: Currency;
	["HistoryItem"]: {
	__typename: "HistoryItem",
	id: string,
	type: GraphQLTypes["HistoryItemType"],
	position: GraphQLTypes["Position"],
	fillSize: GraphQLTypes["BigDecimal"],
	fillCost: GraphQLTypes["BigDecimal"],
	fillPrice: GraphQLTypes["BigDecimal"],
	cashflowCcy: GraphQLTypes["Currency"],
	cashflowBase: GraphQLTypes["BigDecimal"],
	cashflowQuote: GraphQLTypes["BigDecimal"],
	equityBase: GraphQLTypes["BigDecimal"],
	equityQuote: GraphQLTypes["BigDecimal"],
	previousOpenQuantity: GraphQLTypes["BigDecimal"],
	openQuantity: GraphQLTypes["BigDecimal"],
	previousOpenCost: GraphQLTypes["BigDecimal"],
	openCost: GraphQLTypes["BigDecimal"],
	closedCost: GraphQLTypes["BigDecimal"],
	cashflowBaseAcc: GraphQLTypes["BigDecimal"],
	cashflowQuoteAcc: GraphQLTypes["BigDecimal"],
	equityBaseAcc: GraphQLTypes["BigDecimal"],
	equityQuoteAcc: GraphQLTypes["BigDecimal"],
	feeCcy: GraphQLTypes["Currency"],
	feeBase: GraphQLTypes["BigDecimal"],
	feeQuote: GraphQLTypes["BigDecimal"],
	feeBaseAcc: GraphQLTypes["BigDecimal"],
	feeQuoteAcc: GraphQLTypes["BigDecimal"],
	realisedPnLBase: GraphQLTypes["BigDecimal"],
	realisedPnLQuote: GraphQLTypes["BigDecimal"],
	spotPrice?: GraphQLTypes["BigDecimal"] | undefined,
	owner: GraphQLTypes["Account"],
	tradedBy: GraphQLTypes["Account"],
	blockNumber: GraphQLTypes["BigInt"],
	blockTimestamp: GraphQLTypes["BigInt"],
	transactionHash: GraphQLTypes["Bytes"],
	prevTransactionHash?: GraphQLTypes["Bytes"] | undefined,
	dateTime: string,
	executionFeeBase?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote?: GraphQLTypes["BigDecimal"] | undefined
};
	["HistoryItemType"]: HistoryItemType;
	["HistoryItem_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	type?: GraphQLTypes["HistoryItemType"] | undefined,
	type_not?: GraphQLTypes["HistoryItemType"] | undefined,
	type_in?: Array<GraphQLTypes["HistoryItemType"]> | undefined,
	type_not_in?: Array<GraphQLTypes["HistoryItemType"]> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: GraphQLTypes["Position_filter"] | undefined,
	fillSize?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_not?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_gt?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_lt?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_gte?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_lte?: GraphQLTypes["BigDecimal"] | undefined,
	fillSize_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	fillSize_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	fillCost?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_not?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_gt?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_lt?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_gte?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_lte?: GraphQLTypes["BigDecimal"] | undefined,
	fillCost_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	fillCost_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	fillPrice?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_not?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_gt?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_lt?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_gte?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_lte?: GraphQLTypes["BigDecimal"] | undefined,
	fillPrice_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	fillPrice_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowCcy?: GraphQLTypes["Currency"] | undefined,
	cashflowCcy_not?: GraphQLTypes["Currency"] | undefined,
	cashflowCcy_in?: Array<GraphQLTypes["Currency"]> | undefined,
	cashflowCcy_not_in?: Array<GraphQLTypes["Currency"]> | undefined,
	cashflowBase?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuote?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBase?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuote?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	previousOpenQuantity?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_not?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_gt?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_lt?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_gte?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_lte?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenQuantity_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	previousOpenQuantity_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openQuantity?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_not?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_gt?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_lt?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_gte?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_lte?: GraphQLTypes["BigDecimal"] | undefined,
	openQuantity_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openQuantity_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	previousOpenCost?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_not?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_gt?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_lt?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_gte?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_lte?: GraphQLTypes["BigDecimal"] | undefined,
	previousOpenCost_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	previousOpenCost_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openCost?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_not?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_gt?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_lt?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_gte?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_lte?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openCost_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	closedCost?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_not?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_gt?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_lt?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_gte?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_lte?: GraphQLTypes["BigDecimal"] | undefined,
	closedCost_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	closedCost_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowBaseAcc?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBaseAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowBaseAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuoteAcc?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuoteAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuoteAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBaseAcc?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBaseAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBaseAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuoteAcc?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuoteAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuoteAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeCcy?: GraphQLTypes["Currency"] | undefined,
	feeCcy_not?: GraphQLTypes["Currency"] | undefined,
	feeCcy_in?: Array<GraphQLTypes["Currency"]> | undefined,
	feeCcy_not_in?: Array<GraphQLTypes["Currency"]> | undefined,
	feeBase?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feeBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeQuote?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeBaseAcc?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feeBaseAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeBaseAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeQuoteAcc?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_not?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feeQuoteAcc_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feeQuoteAcc_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLBase?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLQuote?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	spotPrice?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_not?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_gt?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_lt?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_gte?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_lte?: GraphQLTypes["BigDecimal"] | undefined,
	spotPrice_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	spotPrice_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: GraphQLTypes["Account_filter"] | undefined,
	tradedBy?: string | undefined,
	tradedBy_not?: string | undefined,
	tradedBy_gt?: string | undefined,
	tradedBy_lt?: string | undefined,
	tradedBy_gte?: string | undefined,
	tradedBy_lte?: string | undefined,
	tradedBy_in?: Array<string> | undefined,
	tradedBy_not_in?: Array<string> | undefined,
	tradedBy_contains?: string | undefined,
	tradedBy_contains_nocase?: string | undefined,
	tradedBy_not_contains?: string | undefined,
	tradedBy_not_contains_nocase?: string | undefined,
	tradedBy_starts_with?: string | undefined,
	tradedBy_starts_with_nocase?: string | undefined,
	tradedBy_not_starts_with?: string | undefined,
	tradedBy_not_starts_with_nocase?: string | undefined,
	tradedBy_ends_with?: string | undefined,
	tradedBy_ends_with_nocase?: string | undefined,
	tradedBy_not_ends_with?: string | undefined,
	tradedBy_not_ends_with_nocase?: string | undefined,
	tradedBy_?: GraphQLTypes["Account_filter"] | undefined,
	blockNumber?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_not?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_gt?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_lt?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_gte?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_lte?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockNumber_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockTimestamp?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_not?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_gt?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_lt?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_gte?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_lte?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockTimestamp_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	transactionHash?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_not?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_gt?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_lt?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_gte?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_lte?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	transactionHash_not_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	transactionHash_contains?: GraphQLTypes["Bytes"] | undefined,
	transactionHash_not_contains?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_not?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_gt?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_lt?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_gte?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_lte?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	prevTransactionHash_not_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	prevTransactionHash_contains?: GraphQLTypes["Bytes"] | undefined,
	prevTransactionHash_not_contains?: GraphQLTypes["Bytes"] | undefined,
	dateTime?: string | undefined,
	dateTime_not?: string | undefined,
	dateTime_gt?: string | undefined,
	dateTime_lt?: string | undefined,
	dateTime_gte?: string | undefined,
	dateTime_lte?: string | undefined,
	dateTime_in?: Array<string> | undefined,
	dateTime_not_in?: Array<string> | undefined,
	dateTime_contains?: string | undefined,
	dateTime_contains_nocase?: string | undefined,
	dateTime_not_contains?: string | undefined,
	dateTime_not_contains_nocase?: string | undefined,
	dateTime_starts_with?: string | undefined,
	dateTime_starts_with_nocase?: string | undefined,
	dateTime_not_starts_with?: string | undefined,
	dateTime_not_starts_with_nocase?: string | undefined,
	dateTime_ends_with?: string | undefined,
	dateTime_ends_with_nocase?: string | undefined,
	dateTime_not_ends_with?: string | undefined,
	dateTime_not_ends_with_nocase?: string | undefined,
	executionFeeBase?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	executionFeeBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	executionFeeQuote?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	executionFeeQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	executionFeeQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenalty?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_not?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_gt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_lt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_gte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_lte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenalty_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenalty_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenaltyBase?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenaltyBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenaltyQuote?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	liquidationPenaltyQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	liquidationPenaltyQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["HistoryItem_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["HistoryItem_filter"] | undefined> | undefined
};
	["HistoryItem_orderBy"]: HistoryItem_orderBy;
	["Instrument"]: {
	__typename: "Instrument",
	id: string,
	symbol: string,
	base: GraphQLTypes["Asset"],
	quote: GraphQLTypes["Asset"],
	positions: Array<GraphQLTypes["Position"]>,
	orders: Array<GraphQLTypes["Order"]>
};
	["InstrumentTotal"]: {
	__typename: "InstrumentTotal",
	id: string,
	symbol: string,
	openInterest: GraphQLTypes["BigDecimal"],
	totalVolume: GraphQLTypes["BigDecimal"],
	totalFees: GraphQLTypes["BigDecimal"],
	openPositions: GraphQLTypes["BigInt"],
	totalPositions: GraphQLTypes["BigInt"]
};
	["InstrumentTotal_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	openInterest?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_not?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_gt?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_lt?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_gte?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_lte?: GraphQLTypes["BigDecimal"] | undefined,
	openInterest_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openInterest_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalVolume?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_not?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_gt?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_lt?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_gte?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_lte?: GraphQLTypes["BigDecimal"] | undefined,
	totalVolume_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalVolume_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalFees?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_not?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_gt?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_lt?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_gte?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_lte?: GraphQLTypes["BigDecimal"] | undefined,
	totalFees_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	totalFees_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openPositions?: GraphQLTypes["BigInt"] | undefined,
	openPositions_not?: GraphQLTypes["BigInt"] | undefined,
	openPositions_gt?: GraphQLTypes["BigInt"] | undefined,
	openPositions_lt?: GraphQLTypes["BigInt"] | undefined,
	openPositions_gte?: GraphQLTypes["BigInt"] | undefined,
	openPositions_lte?: GraphQLTypes["BigInt"] | undefined,
	openPositions_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	openPositions_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	totalPositions?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_not?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_gt?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_lt?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_gte?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_lte?: GraphQLTypes["BigInt"] | undefined,
	totalPositions_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	totalPositions_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["InstrumentTotal_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["InstrumentTotal_filter"] | undefined> | undefined
};
	["InstrumentTotal_orderBy"]: InstrumentTotal_orderBy;
	["Instrument_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	symbol?: string | undefined,
	symbol_not?: string | undefined,
	symbol_gt?: string | undefined,
	symbol_lt?: string | undefined,
	symbol_gte?: string | undefined,
	symbol_lte?: string | undefined,
	symbol_in?: Array<string> | undefined,
	symbol_not_in?: Array<string> | undefined,
	symbol_contains?: string | undefined,
	symbol_contains_nocase?: string | undefined,
	symbol_not_contains?: string | undefined,
	symbol_not_contains_nocase?: string | undefined,
	symbol_starts_with?: string | undefined,
	symbol_starts_with_nocase?: string | undefined,
	symbol_not_starts_with?: string | undefined,
	symbol_not_starts_with_nocase?: string | undefined,
	symbol_ends_with?: string | undefined,
	symbol_ends_with_nocase?: string | undefined,
	symbol_not_ends_with?: string | undefined,
	symbol_not_ends_with_nocase?: string | undefined,
	base?: string | undefined,
	base_not?: string | undefined,
	base_gt?: string | undefined,
	base_lt?: string | undefined,
	base_gte?: string | undefined,
	base_lte?: string | undefined,
	base_in?: Array<string> | undefined,
	base_not_in?: Array<string> | undefined,
	base_contains?: string | undefined,
	base_contains_nocase?: string | undefined,
	base_not_contains?: string | undefined,
	base_not_contains_nocase?: string | undefined,
	base_starts_with?: string | undefined,
	base_starts_with_nocase?: string | undefined,
	base_not_starts_with?: string | undefined,
	base_not_starts_with_nocase?: string | undefined,
	base_ends_with?: string | undefined,
	base_ends_with_nocase?: string | undefined,
	base_not_ends_with?: string | undefined,
	base_not_ends_with_nocase?: string | undefined,
	base_?: GraphQLTypes["Asset_filter"] | undefined,
	quote?: string | undefined,
	quote_not?: string | undefined,
	quote_gt?: string | undefined,
	quote_lt?: string | undefined,
	quote_gte?: string | undefined,
	quote_lte?: string | undefined,
	quote_in?: Array<string> | undefined,
	quote_not_in?: Array<string> | undefined,
	quote_contains?: string | undefined,
	quote_contains_nocase?: string | undefined,
	quote_not_contains?: string | undefined,
	quote_not_contains_nocase?: string | undefined,
	quote_starts_with?: string | undefined,
	quote_starts_with_nocase?: string | undefined,
	quote_not_starts_with?: string | undefined,
	quote_not_starts_with_nocase?: string | undefined,
	quote_ends_with?: string | undefined,
	quote_ends_with_nocase?: string | undefined,
	quote_not_ends_with?: string | undefined,
	quote_not_ends_with_nocase?: string | undefined,
	quote_?: GraphQLTypes["Asset_filter"] | undefined,
	positions_?: GraphQLTypes["Position_filter"] | undefined,
	orders_?: GraphQLTypes["Order_filter"] | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["Instrument_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["Instrument_filter"] | undefined> | undefined
};
	["Instrument_orderBy"]: Instrument_orderBy;
	/** 8 bytes signed integer */
["Int8"]: "scalar" & { name: "Int8" };
	["MoneyMarket"]: MoneyMarket;
	["Order"]: {
	__typename: "Order",
	id: string,
	position?: GraphQLTypes["Position"] | undefined,
	instrument: GraphQLTypes["Instrument"],
	owner: GraphQLTypes["Account"],
	side: GraphQLTypes["Side"],
	type: GraphQLTypes["OrderType"],
	quantity: GraphQLTypes["BigInt"],
	limitPrice: GraphQLTypes["BigInt"],
	tolerance?: GraphQLTypes["BigInt"] | undefined,
	cashflow: GraphQLTypes["BigInt"],
	cashflowCcy: GraphQLTypes["Currency"],
	deadline: GraphQLTypes["BigInt"],
	placedBy: GraphQLTypes["Account"],
	blockNumber: GraphQLTypes["BigInt"],
	blockTimestamp: GraphQLTypes["BigInt"],
	dateTime: string
};
	/** Defines the order direction, either ascending or descending */
["OrderDirection"]: OrderDirection;
	["OrderType"]: OrderType;
	["Order_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: GraphQLTypes["Position_filter"] | undefined,
	instrument?: string | undefined,
	instrument_not?: string | undefined,
	instrument_gt?: string | undefined,
	instrument_lt?: string | undefined,
	instrument_gte?: string | undefined,
	instrument_lte?: string | undefined,
	instrument_in?: Array<string> | undefined,
	instrument_not_in?: Array<string> | undefined,
	instrument_contains?: string | undefined,
	instrument_contains_nocase?: string | undefined,
	instrument_not_contains?: string | undefined,
	instrument_not_contains_nocase?: string | undefined,
	instrument_starts_with?: string | undefined,
	instrument_starts_with_nocase?: string | undefined,
	instrument_not_starts_with?: string | undefined,
	instrument_not_starts_with_nocase?: string | undefined,
	instrument_ends_with?: string | undefined,
	instrument_ends_with_nocase?: string | undefined,
	instrument_not_ends_with?: string | undefined,
	instrument_not_ends_with_nocase?: string | undefined,
	instrument_?: GraphQLTypes["Instrument_filter"] | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: GraphQLTypes["Account_filter"] | undefined,
	side?: GraphQLTypes["Side"] | undefined,
	side_not?: GraphQLTypes["Side"] | undefined,
	side_in?: Array<GraphQLTypes["Side"]> | undefined,
	side_not_in?: Array<GraphQLTypes["Side"]> | undefined,
	type?: GraphQLTypes["OrderType"] | undefined,
	type_not?: GraphQLTypes["OrderType"] | undefined,
	type_in?: Array<GraphQLTypes["OrderType"]> | undefined,
	type_not_in?: Array<GraphQLTypes["OrderType"]> | undefined,
	quantity?: GraphQLTypes["BigInt"] | undefined,
	quantity_not?: GraphQLTypes["BigInt"] | undefined,
	quantity_gt?: GraphQLTypes["BigInt"] | undefined,
	quantity_lt?: GraphQLTypes["BigInt"] | undefined,
	quantity_gte?: GraphQLTypes["BigInt"] | undefined,
	quantity_lte?: GraphQLTypes["BigInt"] | undefined,
	quantity_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	quantity_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	limitPrice?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_not?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_gt?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_lt?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_gte?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_lte?: GraphQLTypes["BigInt"] | undefined,
	limitPrice_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	limitPrice_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	tolerance?: GraphQLTypes["BigInt"] | undefined,
	tolerance_not?: GraphQLTypes["BigInt"] | undefined,
	tolerance_gt?: GraphQLTypes["BigInt"] | undefined,
	tolerance_lt?: GraphQLTypes["BigInt"] | undefined,
	tolerance_gte?: GraphQLTypes["BigInt"] | undefined,
	tolerance_lte?: GraphQLTypes["BigInt"] | undefined,
	tolerance_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	tolerance_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	cashflow?: GraphQLTypes["BigInt"] | undefined,
	cashflow_not?: GraphQLTypes["BigInt"] | undefined,
	cashflow_gt?: GraphQLTypes["BigInt"] | undefined,
	cashflow_lt?: GraphQLTypes["BigInt"] | undefined,
	cashflow_gte?: GraphQLTypes["BigInt"] | undefined,
	cashflow_lte?: GraphQLTypes["BigInt"] | undefined,
	cashflow_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	cashflow_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	cashflowCcy?: GraphQLTypes["Currency"] | undefined,
	cashflowCcy_not?: GraphQLTypes["Currency"] | undefined,
	cashflowCcy_in?: Array<GraphQLTypes["Currency"]> | undefined,
	cashflowCcy_not_in?: Array<GraphQLTypes["Currency"]> | undefined,
	deadline?: GraphQLTypes["BigInt"] | undefined,
	deadline_not?: GraphQLTypes["BigInt"] | undefined,
	deadline_gt?: GraphQLTypes["BigInt"] | undefined,
	deadline_lt?: GraphQLTypes["BigInt"] | undefined,
	deadline_gte?: GraphQLTypes["BigInt"] | undefined,
	deadline_lte?: GraphQLTypes["BigInt"] | undefined,
	deadline_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	deadline_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	placedBy?: string | undefined,
	placedBy_not?: string | undefined,
	placedBy_gt?: string | undefined,
	placedBy_lt?: string | undefined,
	placedBy_gte?: string | undefined,
	placedBy_lte?: string | undefined,
	placedBy_in?: Array<string> | undefined,
	placedBy_not_in?: Array<string> | undefined,
	placedBy_contains?: string | undefined,
	placedBy_contains_nocase?: string | undefined,
	placedBy_not_contains?: string | undefined,
	placedBy_not_contains_nocase?: string | undefined,
	placedBy_starts_with?: string | undefined,
	placedBy_starts_with_nocase?: string | undefined,
	placedBy_not_starts_with?: string | undefined,
	placedBy_not_starts_with_nocase?: string | undefined,
	placedBy_ends_with?: string | undefined,
	placedBy_ends_with_nocase?: string | undefined,
	placedBy_not_ends_with?: string | undefined,
	placedBy_not_ends_with_nocase?: string | undefined,
	placedBy_?: GraphQLTypes["Account_filter"] | undefined,
	blockNumber?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_not?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_gt?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_lt?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_gte?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_lte?: GraphQLTypes["BigInt"] | undefined,
	blockNumber_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockNumber_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockTimestamp?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_not?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_gt?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_lt?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_gte?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_lte?: GraphQLTypes["BigInt"] | undefined,
	blockTimestamp_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	blockTimestamp_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	dateTime?: string | undefined,
	dateTime_not?: string | undefined,
	dateTime_gt?: string | undefined,
	dateTime_lt?: string | undefined,
	dateTime_gte?: string | undefined,
	dateTime_lte?: string | undefined,
	dateTime_in?: Array<string> | undefined,
	dateTime_not_in?: Array<string> | undefined,
	dateTime_contains?: string | undefined,
	dateTime_contains_nocase?: string | undefined,
	dateTime_not_contains?: string | undefined,
	dateTime_not_contains_nocase?: string | undefined,
	dateTime_starts_with?: string | undefined,
	dateTime_starts_with_nocase?: string | undefined,
	dateTime_not_starts_with?: string | undefined,
	dateTime_not_starts_with_nocase?: string | undefined,
	dateTime_ends_with?: string | undefined,
	dateTime_ends_with_nocase?: string | undefined,
	dateTime_not_ends_with?: string | undefined,
	dateTime_not_ends_with_nocase?: string | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["Order_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["Order_filter"] | undefined> | undefined
};
	["Order_orderBy"]: Order_orderBy;
	["Position"]: {
	__typename: "Position",
	id: string,
	instrument: GraphQLTypes["Instrument"],
	owner: GraphQLTypes["Account"],
	moneyMarket: GraphQLTypes["MoneyMarket"],
	number: GraphQLTypes["BigInt"],
	expiry: GraphQLTypes["BigInt"],
	quantity: GraphQLTypes["BigDecimal"],
	openCost: GraphQLTypes["BigDecimal"],
	feesBase: GraphQLTypes["BigDecimal"],
	feesQuote: GraphQLTypes["BigDecimal"],
	realisedPnLBase: GraphQLTypes["BigDecimal"],
	realisedPnLQuote: GraphQLTypes["BigDecimal"],
	cashflowBase: GraphQLTypes["BigDecimal"],
	cashflowQuote: GraphQLTypes["BigDecimal"],
	equityBase: GraphQLTypes["BigDecimal"],
	equityQuote: GraphQLTypes["BigDecimal"],
	history: Array<GraphQLTypes["HistoryItem"]>,
	orders: Array<GraphQLTypes["Order"]>,
	latestTransactionHash?: GraphQLTypes["Bytes"] | undefined,
	creationBlockNumber: GraphQLTypes["BigInt"],
	creationBlockTimestamp: GraphQLTypes["BigInt"],
	creationTransactionHash: GraphQLTypes["Bytes"],
	creationDateTime: string,
	claimableRewards: boolean
};
	["Position_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	instrument?: string | undefined,
	instrument_not?: string | undefined,
	instrument_gt?: string | undefined,
	instrument_lt?: string | undefined,
	instrument_gte?: string | undefined,
	instrument_lte?: string | undefined,
	instrument_in?: Array<string> | undefined,
	instrument_not_in?: Array<string> | undefined,
	instrument_contains?: string | undefined,
	instrument_contains_nocase?: string | undefined,
	instrument_not_contains?: string | undefined,
	instrument_not_contains_nocase?: string | undefined,
	instrument_starts_with?: string | undefined,
	instrument_starts_with_nocase?: string | undefined,
	instrument_not_starts_with?: string | undefined,
	instrument_not_starts_with_nocase?: string | undefined,
	instrument_ends_with?: string | undefined,
	instrument_ends_with_nocase?: string | undefined,
	instrument_not_ends_with?: string | undefined,
	instrument_not_ends_with_nocase?: string | undefined,
	instrument_?: GraphQLTypes["Instrument_filter"] | undefined,
	owner?: string | undefined,
	owner_not?: string | undefined,
	owner_gt?: string | undefined,
	owner_lt?: string | undefined,
	owner_gte?: string | undefined,
	owner_lte?: string | undefined,
	owner_in?: Array<string> | undefined,
	owner_not_in?: Array<string> | undefined,
	owner_contains?: string | undefined,
	owner_contains_nocase?: string | undefined,
	owner_not_contains?: string | undefined,
	owner_not_contains_nocase?: string | undefined,
	owner_starts_with?: string | undefined,
	owner_starts_with_nocase?: string | undefined,
	owner_not_starts_with?: string | undefined,
	owner_not_starts_with_nocase?: string | undefined,
	owner_ends_with?: string | undefined,
	owner_ends_with_nocase?: string | undefined,
	owner_not_ends_with?: string | undefined,
	owner_not_ends_with_nocase?: string | undefined,
	owner_?: GraphQLTypes["Account_filter"] | undefined,
	moneyMarket?: GraphQLTypes["MoneyMarket"] | undefined,
	moneyMarket_not?: GraphQLTypes["MoneyMarket"] | undefined,
	moneyMarket_in?: Array<GraphQLTypes["MoneyMarket"]> | undefined,
	moneyMarket_not_in?: Array<GraphQLTypes["MoneyMarket"]> | undefined,
	number?: GraphQLTypes["BigInt"] | undefined,
	number_not?: GraphQLTypes["BigInt"] | undefined,
	number_gt?: GraphQLTypes["BigInt"] | undefined,
	number_lt?: GraphQLTypes["BigInt"] | undefined,
	number_gte?: GraphQLTypes["BigInt"] | undefined,
	number_lte?: GraphQLTypes["BigInt"] | undefined,
	number_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	number_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	expiry?: GraphQLTypes["BigInt"] | undefined,
	expiry_not?: GraphQLTypes["BigInt"] | undefined,
	expiry_gt?: GraphQLTypes["BigInt"] | undefined,
	expiry_lt?: GraphQLTypes["BigInt"] | undefined,
	expiry_gte?: GraphQLTypes["BigInt"] | undefined,
	expiry_lte?: GraphQLTypes["BigInt"] | undefined,
	expiry_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	expiry_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	quantity?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_not?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_gt?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_lt?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_gte?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_lte?: GraphQLTypes["BigDecimal"] | undefined,
	quantity_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	quantity_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openCost?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_not?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_gt?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_lt?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_gte?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_lte?: GraphQLTypes["BigDecimal"] | undefined,
	openCost_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	openCost_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feesBase?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feesBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feesBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feesQuote?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	feesQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	feesQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLBase?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLQuote?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	realisedPnLQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	realisedPnLQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowBase?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuote?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	cashflowQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	cashflowQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBase?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityBase_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityBase_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuote?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_not?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_gt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_lt?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_gte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_lte?: GraphQLTypes["BigDecimal"] | undefined,
	equityQuote_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	equityQuote_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	history_?: GraphQLTypes["HistoryItem_filter"] | undefined,
	orders_?: GraphQLTypes["Order_filter"] | undefined,
	latestTransactionHash?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_not?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_gt?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_lt?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_gte?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_lte?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	latestTransactionHash_not_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	latestTransactionHash_contains?: GraphQLTypes["Bytes"] | undefined,
	latestTransactionHash_not_contains?: GraphQLTypes["Bytes"] | undefined,
	creationBlockNumber?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_not?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_gt?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_lt?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_gte?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_lte?: GraphQLTypes["BigInt"] | undefined,
	creationBlockNumber_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	creationBlockNumber_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	creationBlockTimestamp?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_not?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_gt?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_lt?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_gte?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_lte?: GraphQLTypes["BigInt"] | undefined,
	creationBlockTimestamp_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	creationBlockTimestamp_not_in?: Array<GraphQLTypes["BigInt"]> | undefined,
	creationTransactionHash?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_not?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_gt?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_lt?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_gte?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_lte?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	creationTransactionHash_not_in?: Array<GraphQLTypes["Bytes"]> | undefined,
	creationTransactionHash_contains?: GraphQLTypes["Bytes"] | undefined,
	creationTransactionHash_not_contains?: GraphQLTypes["Bytes"] | undefined,
	creationDateTime?: string | undefined,
	creationDateTime_not?: string | undefined,
	creationDateTime_gt?: string | undefined,
	creationDateTime_lt?: string | undefined,
	creationDateTime_gte?: string | undefined,
	creationDateTime_lte?: string | undefined,
	creationDateTime_in?: Array<string> | undefined,
	creationDateTime_not_in?: Array<string> | undefined,
	creationDateTime_contains?: string | undefined,
	creationDateTime_contains_nocase?: string | undefined,
	creationDateTime_not_contains?: string | undefined,
	creationDateTime_not_contains_nocase?: string | undefined,
	creationDateTime_starts_with?: string | undefined,
	creationDateTime_starts_with_nocase?: string | undefined,
	creationDateTime_not_starts_with?: string | undefined,
	creationDateTime_not_starts_with_nocase?: string | undefined,
	creationDateTime_ends_with?: string | undefined,
	creationDateTime_ends_with_nocase?: string | undefined,
	creationDateTime_not_ends_with?: string | undefined,
	creationDateTime_not_ends_with_nocase?: string | undefined,
	claimableRewards?: boolean | undefined,
	claimableRewards_not?: boolean | undefined,
	claimableRewards_in?: Array<boolean> | undefined,
	claimableRewards_not_in?: Array<boolean> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["Position_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["Position_filter"] | undefined> | undefined
};
	["Position_orderBy"]: Position_orderBy;
	["Query"]: {
	__typename: "Query",
	asset?: GraphQLTypes["Asset"] | undefined,
	assets: Array<GraphQLTypes["Asset"]>,
	assetTotal?: GraphQLTypes["AssetTotal"] | undefined,
	assetTotals: Array<GraphQLTypes["AssetTotal"]>,
	instrument?: GraphQLTypes["Instrument"] | undefined,
	instruments: Array<GraphQLTypes["Instrument"]>,
	instrumentTotal?: GraphQLTypes["InstrumentTotal"] | undefined,
	instrumentTotals: Array<GraphQLTypes["InstrumentTotal"]>,
	underlyingPosition?: GraphQLTypes["UnderlyingPosition"] | undefined,
	underlyingPositions: Array<GraphQLTypes["UnderlyingPosition"]>,
	account?: GraphQLTypes["Account"] | undefined,
	accounts: Array<GraphQLTypes["Account"]>,
	referralCounter?: GraphQLTypes["ReferralCounter"] | undefined,
	referralCounters: Array<GraphQLTypes["ReferralCounter"]>,
	position?: GraphQLTypes["Position"] | undefined,
	positions: Array<GraphQLTypes["Position"]>,
	historyItem?: GraphQLTypes["HistoryItem"] | undefined,
	historyItems: Array<GraphQLTypes["HistoryItem"]>,
	order?: GraphQLTypes["Order"] | undefined,
	orders: Array<GraphQLTypes["Order"]>,
	/** Access to subgraph metadata */
	_meta?: GraphQLTypes["_Meta_"] | undefined
};
	["ReferralCounter"]: {
	__typename: "ReferralCounter",
	id: string,
	account: GraphQLTypes["Account"],
	asset: GraphQLTypes["Asset"],
	rebates: GraphQLTypes["BigDecimal"],
	rewards: GraphQLTypes["BigDecimal"]
};
	["ReferralCounter_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	account?: string | undefined,
	account_not?: string | undefined,
	account_gt?: string | undefined,
	account_lt?: string | undefined,
	account_gte?: string | undefined,
	account_lte?: string | undefined,
	account_in?: Array<string> | undefined,
	account_not_in?: Array<string> | undefined,
	account_contains?: string | undefined,
	account_contains_nocase?: string | undefined,
	account_not_contains?: string | undefined,
	account_not_contains_nocase?: string | undefined,
	account_starts_with?: string | undefined,
	account_starts_with_nocase?: string | undefined,
	account_not_starts_with?: string | undefined,
	account_not_starts_with_nocase?: string | undefined,
	account_ends_with?: string | undefined,
	account_ends_with_nocase?: string | undefined,
	account_not_ends_with?: string | undefined,
	account_not_ends_with_nocase?: string | undefined,
	account_?: GraphQLTypes["Account_filter"] | undefined,
	asset?: string | undefined,
	asset_not?: string | undefined,
	asset_gt?: string | undefined,
	asset_lt?: string | undefined,
	asset_gte?: string | undefined,
	asset_lte?: string | undefined,
	asset_in?: Array<string> | undefined,
	asset_not_in?: Array<string> | undefined,
	asset_contains?: string | undefined,
	asset_contains_nocase?: string | undefined,
	asset_not_contains?: string | undefined,
	asset_not_contains_nocase?: string | undefined,
	asset_starts_with?: string | undefined,
	asset_starts_with_nocase?: string | undefined,
	asset_not_starts_with?: string | undefined,
	asset_not_starts_with_nocase?: string | undefined,
	asset_ends_with?: string | undefined,
	asset_ends_with_nocase?: string | undefined,
	asset_not_ends_with?: string | undefined,
	asset_not_ends_with_nocase?: string | undefined,
	asset_?: GraphQLTypes["Asset_filter"] | undefined,
	rebates?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_not?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_gt?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_lt?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_gte?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_lte?: GraphQLTypes["BigDecimal"] | undefined,
	rebates_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	rebates_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	rewards?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_not?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_gt?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_lt?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_gte?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_lte?: GraphQLTypes["BigDecimal"] | undefined,
	rewards_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	rewards_not_in?: Array<GraphQLTypes["BigDecimal"]> | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["ReferralCounter_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["ReferralCounter_filter"] | undefined> | undefined
};
	["ReferralCounter_orderBy"]: ReferralCounter_orderBy;
	["Side"]: Side;
	["Subscription"]: {
	__typename: "Subscription",
	asset?: GraphQLTypes["Asset"] | undefined,
	assets: Array<GraphQLTypes["Asset"]>,
	assetTotal?: GraphQLTypes["AssetTotal"] | undefined,
	assetTotals: Array<GraphQLTypes["AssetTotal"]>,
	instrument?: GraphQLTypes["Instrument"] | undefined,
	instruments: Array<GraphQLTypes["Instrument"]>,
	instrumentTotal?: GraphQLTypes["InstrumentTotal"] | undefined,
	instrumentTotals: Array<GraphQLTypes["InstrumentTotal"]>,
	underlyingPosition?: GraphQLTypes["UnderlyingPosition"] | undefined,
	underlyingPositions: Array<GraphQLTypes["UnderlyingPosition"]>,
	account?: GraphQLTypes["Account"] | undefined,
	accounts: Array<GraphQLTypes["Account"]>,
	referralCounter?: GraphQLTypes["ReferralCounter"] | undefined,
	referralCounters: Array<GraphQLTypes["ReferralCounter"]>,
	position?: GraphQLTypes["Position"] | undefined,
	positions: Array<GraphQLTypes["Position"]>,
	historyItem?: GraphQLTypes["HistoryItem"] | undefined,
	historyItems: Array<GraphQLTypes["HistoryItem"]>,
	order?: GraphQLTypes["Order"] | undefined,
	orders: Array<GraphQLTypes["Order"]>,
	/** Access to subgraph metadata */
	_meta?: GraphQLTypes["_Meta_"] | undefined
};
	["UnderlyingPosition"]: {
	__typename: "UnderlyingPosition",
	id: string,
	position: GraphQLTypes["Position"]
};
	["UnderlyingPosition_filter"]: {
		id?: string | undefined,
	id_not?: string | undefined,
	id_gt?: string | undefined,
	id_lt?: string | undefined,
	id_gte?: string | undefined,
	id_lte?: string | undefined,
	id_in?: Array<string> | undefined,
	id_not_in?: Array<string> | undefined,
	position?: string | undefined,
	position_not?: string | undefined,
	position_gt?: string | undefined,
	position_lt?: string | undefined,
	position_gte?: string | undefined,
	position_lte?: string | undefined,
	position_in?: Array<string> | undefined,
	position_not_in?: Array<string> | undefined,
	position_contains?: string | undefined,
	position_contains_nocase?: string | undefined,
	position_not_contains?: string | undefined,
	position_not_contains_nocase?: string | undefined,
	position_starts_with?: string | undefined,
	position_starts_with_nocase?: string | undefined,
	position_not_starts_with?: string | undefined,
	position_not_starts_with_nocase?: string | undefined,
	position_ends_with?: string | undefined,
	position_ends_with_nocase?: string | undefined,
	position_not_ends_with?: string | undefined,
	position_not_ends_with_nocase?: string | undefined,
	position_?: GraphQLTypes["Position_filter"] | undefined,
	/** Filter for the block changed event. */
	_change_block?: GraphQLTypes["BlockChangedFilter"] | undefined,
	and?: Array<GraphQLTypes["UnderlyingPosition_filter"] | undefined> | undefined,
	or?: Array<GraphQLTypes["UnderlyingPosition_filter"] | undefined> | undefined
};
	["UnderlyingPosition_orderBy"]: UnderlyingPosition_orderBy;
	["_Block_"]: {
	__typename: "_Block_",
	/** The hash of the block */
	hash?: GraphQLTypes["Bytes"] | undefined,
	/** The block number */
	number: number,
	/** Integer representation of the timestamp stored in blocks for the chain */
	timestamp?: number | undefined
};
	/** The type for the top-level _meta field */
["_Meta_"]: {
	__typename: "_Meta_",
	/** Information about a specific subgraph block. The hash of the block
will be null if the _meta field has a block constraint that asks for
a block number. It will be filled if the _meta field has no block constraint
and therefore asks for the latest  block */
	block: GraphQLTypes["_Block_"],
	/** The deployment ID */
	deployment: string,
	/** If `true`, the subgraph encountered indexing errors at some past block */
	hasIndexingErrors: boolean
};
	["_SubgraphErrorPolicy_"]: _SubgraphErrorPolicy_
    }
export const enum Account_orderBy {
	id = "id",
	positions = "positions",
	orders = "orders",
	referralCounters = "referralCounters",
	referralCode = "referralCode",
	referredByCode = "referredByCode"
}
export const enum AssetTotal_orderBy {
	id = "id",
	symbol = "symbol",
	openInterest = "openInterest",
	totalVolume = "totalVolume",
	totalFees = "totalFees",
	openPositions = "openPositions",
	totalPositions = "totalPositions"
}
export const enum Asset_orderBy {
	id = "id",
	name = "name",
	symbol = "symbol",
	decimals = "decimals"
}
export const enum Currency {
	None = "None",
	Base = "Base",
	Quote = "Quote"
}
export const enum HistoryItemType {
	Open = "Open",
	Modification = "Modification",
	Liquidation = "Liquidation",
	Close = "Close",
	Delivery = "Delivery"
}
export const enum HistoryItem_orderBy {
	id = "id",
	type = "type",
	position = "position",
	position__id = "position__id",
	position__moneyMarket = "position__moneyMarket",
	position__number = "position__number",
	position__expiry = "position__expiry",
	position__quantity = "position__quantity",
	position__openCost = "position__openCost",
	position__feesBase = "position__feesBase",
	position__feesQuote = "position__feesQuote",
	position__realisedPnLBase = "position__realisedPnLBase",
	position__realisedPnLQuote = "position__realisedPnLQuote",
	position__cashflowBase = "position__cashflowBase",
	position__cashflowQuote = "position__cashflowQuote",
	position__equityBase = "position__equityBase",
	position__equityQuote = "position__equityQuote",
	position__latestTransactionHash = "position__latestTransactionHash",
	position__creationBlockNumber = "position__creationBlockNumber",
	position__creationBlockTimestamp = "position__creationBlockTimestamp",
	position__creationTransactionHash = "position__creationTransactionHash",
	position__creationDateTime = "position__creationDateTime",
	position__claimableRewards = "position__claimableRewards",
	fillSize = "fillSize",
	fillCost = "fillCost",
	fillPrice = "fillPrice",
	cashflowCcy = "cashflowCcy",
	cashflowBase = "cashflowBase",
	cashflowQuote = "cashflowQuote",
	equityBase = "equityBase",
	equityQuote = "equityQuote",
	previousOpenQuantity = "previousOpenQuantity",
	openQuantity = "openQuantity",
	previousOpenCost = "previousOpenCost",
	openCost = "openCost",
	closedCost = "closedCost",
	cashflowBaseAcc = "cashflowBaseAcc",
	cashflowQuoteAcc = "cashflowQuoteAcc",
	equityBaseAcc = "equityBaseAcc",
	equityQuoteAcc = "equityQuoteAcc",
	feeCcy = "feeCcy",
	feeBase = "feeBase",
	feeQuote = "feeQuote",
	feeBaseAcc = "feeBaseAcc",
	feeQuoteAcc = "feeQuoteAcc",
	realisedPnLBase = "realisedPnLBase",
	realisedPnLQuote = "realisedPnLQuote",
	spotPrice = "spotPrice",
	owner = "owner",
	owner__id = "owner__id",
	owner__referralCode = "owner__referralCode",
	owner__referredByCode = "owner__referredByCode",
	tradedBy = "tradedBy",
	tradedBy__id = "tradedBy__id",
	tradedBy__referralCode = "tradedBy__referralCode",
	tradedBy__referredByCode = "tradedBy__referredByCode",
	blockNumber = "blockNumber",
	blockTimestamp = "blockTimestamp",
	transactionHash = "transactionHash",
	prevTransactionHash = "prevTransactionHash",
	dateTime = "dateTime",
	executionFeeBase = "executionFeeBase",
	executionFeeQuote = "executionFeeQuote",
	liquidationPenalty = "liquidationPenalty",
	liquidationPenaltyBase = "liquidationPenaltyBase",
	liquidationPenaltyQuote = "liquidationPenaltyQuote"
}
export const enum InstrumentTotal_orderBy {
	id = "id",
	symbol = "symbol",
	openInterest = "openInterest",
	totalVolume = "totalVolume",
	totalFees = "totalFees",
	openPositions = "openPositions",
	totalPositions = "totalPositions"
}
export const enum Instrument_orderBy {
	id = "id",
	symbol = "symbol",
	base = "base",
	base__id = "base__id",
	base__name = "base__name",
	base__symbol = "base__symbol",
	base__decimals = "base__decimals",
	quote = "quote",
	quote__id = "quote__id",
	quote__name = "quote__name",
	quote__symbol = "quote__symbol",
	quote__decimals = "quote__decimals",
	positions = "positions",
	orders = "orders"
}
export const enum MoneyMarket {
	Aave = "Aave",
	Compound = "Compound",
	Yield = "Yield",
	Exactly = "Exactly",
	Sonne = "Sonne",
	Spark = "Spark",
	MorphoBlue = "MorphoBlue",
	Agave = "Agave",
	AaveV2 = "AaveV2",
	Radiant = "Radiant"
}
/** Defines the order direction, either ascending or descending */
export const enum OrderDirection {
	asc = "asc",
	desc = "desc"
}
export const enum OrderType {
	Limit = "Limit",
	TakeProfit = "TakeProfit",
	StopLoss = "StopLoss"
}
export const enum Order_orderBy {
	id = "id",
	position = "position",
	position__id = "position__id",
	position__moneyMarket = "position__moneyMarket",
	position__number = "position__number",
	position__expiry = "position__expiry",
	position__quantity = "position__quantity",
	position__openCost = "position__openCost",
	position__feesBase = "position__feesBase",
	position__feesQuote = "position__feesQuote",
	position__realisedPnLBase = "position__realisedPnLBase",
	position__realisedPnLQuote = "position__realisedPnLQuote",
	position__cashflowBase = "position__cashflowBase",
	position__cashflowQuote = "position__cashflowQuote",
	position__equityBase = "position__equityBase",
	position__equityQuote = "position__equityQuote",
	position__latestTransactionHash = "position__latestTransactionHash",
	position__creationBlockNumber = "position__creationBlockNumber",
	position__creationBlockTimestamp = "position__creationBlockTimestamp",
	position__creationTransactionHash = "position__creationTransactionHash",
	position__creationDateTime = "position__creationDateTime",
	position__claimableRewards = "position__claimableRewards",
	instrument = "instrument",
	instrument__id = "instrument__id",
	instrument__symbol = "instrument__symbol",
	owner = "owner",
	owner__id = "owner__id",
	owner__referralCode = "owner__referralCode",
	owner__referredByCode = "owner__referredByCode",
	side = "side",
	type = "type",
	quantity = "quantity",
	limitPrice = "limitPrice",
	tolerance = "tolerance",
	cashflow = "cashflow",
	cashflowCcy = "cashflowCcy",
	deadline = "deadline",
	placedBy = "placedBy",
	placedBy__id = "placedBy__id",
	placedBy__referralCode = "placedBy__referralCode",
	placedBy__referredByCode = "placedBy__referredByCode",
	blockNumber = "blockNumber",
	blockTimestamp = "blockTimestamp",
	dateTime = "dateTime"
}
export const enum Position_orderBy {
	id = "id",
	instrument = "instrument",
	instrument__id = "instrument__id",
	instrument__symbol = "instrument__symbol",
	owner = "owner",
	owner__id = "owner__id",
	owner__referralCode = "owner__referralCode",
	owner__referredByCode = "owner__referredByCode",
	moneyMarket = "moneyMarket",
	number = "number",
	expiry = "expiry",
	quantity = "quantity",
	openCost = "openCost",
	feesBase = "feesBase",
	feesQuote = "feesQuote",
	realisedPnLBase = "realisedPnLBase",
	realisedPnLQuote = "realisedPnLQuote",
	cashflowBase = "cashflowBase",
	cashflowQuote = "cashflowQuote",
	equityBase = "equityBase",
	equityQuote = "equityQuote",
	history = "history",
	orders = "orders",
	latestTransactionHash = "latestTransactionHash",
	creationBlockNumber = "creationBlockNumber",
	creationBlockTimestamp = "creationBlockTimestamp",
	creationTransactionHash = "creationTransactionHash",
	creationDateTime = "creationDateTime",
	claimableRewards = "claimableRewards"
}
export const enum ReferralCounter_orderBy {
	id = "id",
	account = "account",
	account__id = "account__id",
	account__referralCode = "account__referralCode",
	account__referredByCode = "account__referredByCode",
	asset = "asset",
	asset__id = "asset__id",
	asset__name = "asset__name",
	asset__symbol = "asset__symbol",
	asset__decimals = "asset__decimals",
	rebates = "rebates",
	rewards = "rewards"
}
export const enum Side {
	Buy = "Buy",
	Sell = "Sell"
}
export const enum UnderlyingPosition_orderBy {
	id = "id",
	position = "position",
	position__id = "position__id",
	position__moneyMarket = "position__moneyMarket",
	position__number = "position__number",
	position__expiry = "position__expiry",
	position__quantity = "position__quantity",
	position__openCost = "position__openCost",
	position__feesBase = "position__feesBase",
	position__feesQuote = "position__feesQuote",
	position__realisedPnLBase = "position__realisedPnLBase",
	position__realisedPnLQuote = "position__realisedPnLQuote",
	position__cashflowBase = "position__cashflowBase",
	position__cashflowQuote = "position__cashflowQuote",
	position__equityBase = "position__equityBase",
	position__equityQuote = "position__equityQuote",
	position__latestTransactionHash = "position__latestTransactionHash",
	position__creationBlockNumber = "position__creationBlockNumber",
	position__creationBlockTimestamp = "position__creationBlockTimestamp",
	position__creationTransactionHash = "position__creationTransactionHash",
	position__creationDateTime = "position__creationDateTime",
	position__claimableRewards = "position__claimableRewards"
}
export const enum _SubgraphErrorPolicy_ {
	allow = "allow",
	deny = "deny"
}

type ZEUS_VARIABLES = {
	["Account_filter"]: ValueTypes["Account_filter"];
	["Account_orderBy"]: ValueTypes["Account_orderBy"];
	["AssetTotal_filter"]: ValueTypes["AssetTotal_filter"];
	["AssetTotal_orderBy"]: ValueTypes["AssetTotal_orderBy"];
	["Asset_filter"]: ValueTypes["Asset_filter"];
	["Asset_orderBy"]: ValueTypes["Asset_orderBy"];
	["BigDecimal"]: ValueTypes["BigDecimal"];
	["BigInt"]: ValueTypes["BigInt"];
	["BlockChangedFilter"]: ValueTypes["BlockChangedFilter"];
	["Block_height"]: ValueTypes["Block_height"];
	["Bytes"]: ValueTypes["Bytes"];
	["Currency"]: ValueTypes["Currency"];
	["HistoryItemType"]: ValueTypes["HistoryItemType"];
	["HistoryItem_filter"]: ValueTypes["HistoryItem_filter"];
	["HistoryItem_orderBy"]: ValueTypes["HistoryItem_orderBy"];
	["InstrumentTotal_filter"]: ValueTypes["InstrumentTotal_filter"];
	["InstrumentTotal_orderBy"]: ValueTypes["InstrumentTotal_orderBy"];
	["Instrument_filter"]: ValueTypes["Instrument_filter"];
	["Instrument_orderBy"]: ValueTypes["Instrument_orderBy"];
	["Int8"]: ValueTypes["Int8"];
	["MoneyMarket"]: ValueTypes["MoneyMarket"];
	["OrderDirection"]: ValueTypes["OrderDirection"];
	["OrderType"]: ValueTypes["OrderType"];
	["Order_filter"]: ValueTypes["Order_filter"];
	["Order_orderBy"]: ValueTypes["Order_orderBy"];
	["Position_filter"]: ValueTypes["Position_filter"];
	["Position_orderBy"]: ValueTypes["Position_orderBy"];
	["ReferralCounter_filter"]: ValueTypes["ReferralCounter_filter"];
	["ReferralCounter_orderBy"]: ValueTypes["ReferralCounter_orderBy"];
	["Side"]: ValueTypes["Side"];
	["UnderlyingPosition_filter"]: ValueTypes["UnderlyingPosition_filter"];
	["UnderlyingPosition_orderBy"]: ValueTypes["UnderlyingPosition_orderBy"];
	["_SubgraphErrorPolicy_"]: ValueTypes["_SubgraphErrorPolicy_"];
}