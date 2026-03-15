import { Context } from '@temporalio/activity';
import type { ServiceExpress } from '@openapi-typescript-infra/service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericAny = any;

// Define a helper type to extract the parameters of a function after the first parameter
type TailParameters<T, AppType> = T extends (arg0: AppType, ...rest: infer P) => GenericAny
  ? P
  : never;

// Define a helper type to create a new function signature by excluding the first parameter
type ExcludeFirstParamFn<F, AppType> = F extends (...args: GenericAny[]) => infer R
  ? (...args: TailParameters<F, AppType>) => R
  : never;

type ExcludeFirstParamMap<AppType, T> = {
  [K in keyof T]: ExcludeFirstParamFn<T[K], AppType>;
};

export function createActivities<
  AppType extends ServiceExpress,
  Fns extends Record<string, (app: AppType, ...args: GenericAny[]) => GenericAny>,
>(app: AppType, fns: Fns): ExcludeFirstParamMap<AppType, Fns> {
  const result: Record<string, (...args: unknown[]) => unknown> = {};

  Object.keys(fns).forEach((key) => {
    // Dynamically wrapping each function to inject `app` as the first parameter
    result[key] = async (...args: unknown[]) => {
      const context = Context.current();
      function logFn(
        level: 'trace' | 'debug' | 'info' | 'warn' | 'error',
        attrOrMessage: Record<string, unknown> | string,
        message?: string,
      ) {
        // This will pipe back to our logs
        if (typeof attrOrMessage === 'string') {
          context.log[level](attrOrMessage);
        } else {
          context.log[level](message as string, attrOrMessage);
        }
      }

      const contextApp: AppType = {
        ...app,
        locals: {
          ...app.locals,
          logger: {
            trace: logFn.bind(null, 'trace'),
            debug: logFn.bind(null, 'debug'),
            info: logFn.bind(null, 'info'),
            warn: logFn.bind(null, 'warn'),
            error: logFn.bind(null, 'error'),
          },
        },
      };
      try {
        const result = await fns[key](contextApp, ...args);
        return result;
      } catch (error) {
        app.locals.logger.error(
          Object.assign(error as Error, {
            activity: key,
            workflow: context.info.workflowExecution.workflowId,
          }),
          `Error in activity ${key}`,
        );
        throw error;
      }
    };
  });

  return result as ExcludeFirstParamMap<AppType, Fns>;
}

/**
 * Combine outputs of createActivities, making sure there are no clashes.
 */
export function combineActivities<
  Fns extends Record<string, (...args: GenericAny[]) => GenericAny>[],
>(...fnList: Fns): { [K in keyof Fns[number]]: Fns[number][K] } {
  const result: Record<string, (...args: unknown[]) => unknown> = {};

  fnList.forEach((fns) => {
    const clashes = Object.keys(fns).filter((key) => result[key]);
    if (clashes.length) {
      throw new Error(`Duplicate activity names: ${clashes.join(', ')}`);
    }
    Object.assign(result, fns);
  });

  return result as { [K in keyof Fns[number]]: Fns[number][K] };
}
