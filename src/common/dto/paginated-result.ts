export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

export class PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit) || 0,
    };
  }
}
