declare module "@tryghost/content-api" {
  interface GhostContentAPIOptions {
    url: string;
    key: string;
    version: string;
  }

  interface PostOrPage {
    id: string;
    title: string;
    slug: string;
    html: string;
    plaintext: string;
    excerpt: string | null;
    custom_excerpt: string | null;
    published_at: string;
    updated_at: string;
    primary_author?: {
      name: string;
    };
    tags?: Array<{
      name: string;
    }>;
    url: string;
  }

  interface BrowseOptions {
    limit?: number | "all";
    page?: number;
    filter?: string;
    include?: string | string[];
  }

  interface ReadOptions {
    include?: string | string[];
  }

  interface PostsResponse extends Array<PostOrPage> {
    meta: {
      pagination: {
        page: number;
        limit: number;
        pages: number;
        total: number;
        next: number | null;
        prev: number | null;
      };
    };
  }

  interface Posts {
    read(
      options: { slug: string } | { id: string },
      queryOptions?: ReadOptions,
    ): Promise<PostOrPage>;
    browse(options?: BrowseOptions): Promise<PostsResponse>;
  }

  class GhostContentAPI {
    constructor(options: GhostContentAPIOptions);
    posts: Posts;
  }

  export default GhostContentAPI;
}
