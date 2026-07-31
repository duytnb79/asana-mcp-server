export type JsonObject = Record<string, unknown>;

export type AsanaNextPage = {
  offset: string;
  path?: string;
  uri?: string;
};

export type AsanaPage<T> = {
  data: T[];
  nextPage: AsanaNextPage | null;
};
