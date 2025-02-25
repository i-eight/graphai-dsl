export type OnError = Readonly<{
  message: string;
  error: object;
}>;

export type ErrorResult = Readonly<{
  onError: OnError;
}>;

export const isErrorResult = (result: unknown): result is ErrorResult =>
  typeof result === 'object' && result != null && 'onError' in result;
