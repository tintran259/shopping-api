import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../../catalog/services/categories.service';
import { ProductsService } from '../../catalog/services/products.service';
import { ProductSummaryDto } from '../../catalog/serializers/catalog.serializer';

export interface CategoryRefDto {
  id: string;
  slug: string;
  name: string;
}

export interface SearchSuggestionsDto {
  products: ProductSummaryDto[];
  categories: CategoryRefDto[];
  total: number;
}

@Injectable()
export class SearchService {
  /** Min term length before we hit the DB (mirrors the storefront). */
  private static readonly MIN_LENGTH = 2;

  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
  ) {}

  /** Typeahead suggestions: matching products + categories + total. */
  async suggest(q: string, limit = 6): Promise<SearchSuggestionsDto> {
    const term = (q ?? '').trim();
    if (term.length < SearchService.MIN_LENGTH) {
      return { products: [], categories: [], total: 0 };
    }

    const [{ products, total }, categories] = await Promise.all([
      this.products.suggest(term, limit),
      this.categories.search(term, 4),
    ]);

    return {
      products,
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
      })),
      total,
    };
  }
}
