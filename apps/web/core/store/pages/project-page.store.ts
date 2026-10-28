/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { unset, set, sortBy } from "lodash-es";
import { makeObservable, observable, runInAction, action, reaction, computed } from "mobx";
import { computedFn } from "mobx-utils";
// types
import { EUserPermissions } from "@plane/constants";
import type { TPage, TPageFilters, TPageFolder, TPageListLayout, TPageNavigationTabs } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// helpers
import { filterPagesByPageType, getPageName, orderPages, shouldFilterPage } from "@plane/utils";
// plane web constants
// plane web store
import type { RootStore } from "@/plane-web/store/root.store";
// services
import { ProjectPageFolderService, ProjectPageService } from "@/services/page";
// store
import type { CoreRootStore } from "../root.store";
import type { TProjectPage } from "./project-page";
import { ProjectPage } from "./project-page";

type TLoader = "init-loader" | "mutation-loader" | undefined;

type TError = { title: string; description: string };

export const ROLE_PERMISSIONS_TO_CREATE_PAGE = [
  EUserPermissions.ADMIN,
  EUserPermissions.MEMBER,
  EUserProjectRoles.ADMIN,
  EUserProjectRoles.MEMBER,
];

export interface IProjectPageStore {
  // observables
  loader: TLoader;
  data: Record<string, TProjectPage>; // pageId => Page
  error: TError | undefined;
  filters: TPageFilters;
  folders: Record<string, TPageFolder>; // folderId => Folder
  layout: TPageListLayout;
  // computed
  isAnyPageAvailable: boolean;
  canCurrentUserCreatePage: boolean;
  // helper actions
  getCurrentProjectPageIdsByTab: (pageType: TPageNavigationTabs) => string[] | undefined;
  getCurrentProjectPageIds: (projectId: string) => string[];
  getCurrentProjectFilteredPageIdsByTab: (pageType: TPageNavigationTabs) => string[] | undefined;
  getPageById: (pageId: string) => TProjectPage | undefined;
  updateFilters: <T extends keyof TPageFilters>(filterKey: T, filterValue: TPageFilters[T]) => void;
  clearAllFilters: () => void;
  // actions
  fetchPagesList: (
    workspaceSlug: string,
    projectId: string,
    pageType?: TPageNavigationTabs
  ) => Promise<TPage[] | undefined>;
  fetchPageDetails: (
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    options?: { trackVisit?: boolean }
  ) => Promise<TPage | undefined>;
  createPage: (pageData: Partial<TPage>) => Promise<TPage | undefined>;
  removePage: (params: { pageId: string; shouldSync?: boolean }) => Promise<void>;
  movePage: (workspaceSlug: string, projectId: string, pageId: string, newProjectId: string) => Promise<void>;
  // folder helpers
  getProjectFolders: (projectId: string) => TPageFolder[];
  getChildFolders: (projectId: string, parentId: string | null) => TPageFolder[];
  getFolderPath: (folderId: string | null) => TPageFolder[];
  setLayout: (layout: TPageListLayout) => void;
  // folder actions
  fetchFolders: (workspaceSlug: string, projectId: string) => Promise<TPageFolder[] | undefined>;
  createFolder: (data: Partial<TPageFolder>) => Promise<TPageFolder | undefined>;
  updateFolder: (folderId: string, data: Partial<TPageFolder>) => Promise<TPageFolder | undefined>;
  deleteFolder: (folderId: string) => Promise<void>;
  movePageToFolder: (pageId: string, folderId: string | null) => Promise<void>;
  // tags
  getProjectTags: (projectId: string) => string[];
  updatePageTags: (pageId: string, tags: string[]) => Promise<void>;
  renameProjectTag: (name: string, newName: string) => Promise<number>;
  deleteProjectTag: (name: string) => Promise<number>;
}

const PAGE_LIST_LAYOUT_KEY = "page_list_layout";

const getStoredLayout = (): TPageListLayout => {
  try {
    return localStorage.getItem(PAGE_LIST_LAYOUT_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
};

export class ProjectPageStore implements IProjectPageStore {
  // observables
  loader: TLoader = "init-loader";
  data: Record<string, TProjectPage> = {}; // pageId => Page
  error: TError | undefined = undefined;
  filters: TPageFilters = {
    searchQuery: "",
    sortKey: "updated_at",
    sortBy: "desc",
  };
  folders: Record<string, TPageFolder> = {};
  layout: TPageListLayout = getStoredLayout();
  // service
  service: ProjectPageService;
  folderService: ProjectPageFolderService;
  rootStore: CoreRootStore;

  constructor(private store: RootStore) {
    makeObservable(this, {
      // observables
      loader: observable.ref,
      data: observable,
      error: observable,
      filters: observable,
      folders: observable,
      layout: observable.ref,
      // computed
      isAnyPageAvailable: computed,
      canCurrentUserCreatePage: computed,
      // helper actions
      updateFilters: action,
      clearAllFilters: action,
      // actions
      fetchPagesList: action,
      fetchPageDetails: action,
      createPage: action,
      removePage: action,
      movePage: action,
      setLayout: action,
      fetchFolders: action,
      createFolder: action,
      updateFolder: action,
      deleteFolder: action,
      movePageToFolder: action,
      updatePageTags: action,
      renameProjectTag: action,
      deleteProjectTag: action,
    });
    this.rootStore = store;
    // service
    this.service = new ProjectPageService();
    this.folderService = new ProjectPageFolderService();
    // initialize display filters of the current project
    reaction(
      () => this.store.router.projectId,
      (projectId) => {
        if (!projectId) return;
        this.filters.searchQuery = "";
      }
    );
  }

  /**
   * @description check if any page is available
   */
  get isAnyPageAvailable() {
    if (this.loader) return true;
    return Object.keys(this.data).length > 0;
  }

  /**
   * @description returns true if the current logged in user can create a page
   */
  get canCurrentUserCreatePage() {
    const { workspaceSlug, projectId } = this.store.router;
    const currentUserProjectRole = this.store.user.permission.getProjectRoleByWorkspaceSlugAndProjectId(
      workspaceSlug?.toString() || "",
      projectId?.toString() || ""
    );
    return !!currentUserProjectRole && ROLE_PERMISSIONS_TO_CREATE_PAGE.includes(currentUserProjectRole);
  }

  /**
   * @description get the current project page ids based on the pageType
   * @param {TPageNavigationTabs} pageType
   */
  getCurrentProjectPageIdsByTab = computedFn((pageType: TPageNavigationTabs) => {
    const { projectId } = this.store.router;
    if (!projectId) return undefined;
    // helps to filter pages based on the pageType
    let pagesByType = filterPagesByPageType(pageType, Object.values(this?.data || {}));
    pagesByType = pagesByType.filter((p) => p.project_ids?.includes(projectId));

    const pages = (pagesByType.map((page) => page.id) as string[]) || undefined;

    return pages ?? undefined;
  });

  /**
   * @description get the current project page ids
   * @param {string} projectId
   */
  getCurrentProjectPageIds = computedFn((projectId: string) => {
    if (!projectId) return [];
    const pages = Object.values(this?.data || {}).filter((page) => page.project_ids?.includes(projectId));
    return pages.map((page) => page.id) as string[];
  });

  /**
   * @description get the current project filtered page ids based on the pageType
   * @param {TPageNavigationTabs} pageType
   */
  getCurrentProjectFilteredPageIdsByTab = computedFn((pageType: TPageNavigationTabs) => {
    const { projectId } = this.store.router;
    if (!projectId) return undefined;

    // helps to filter pages based on the pageType
    const pagesByType = filterPagesByPageType(pageType, Object.values(this?.data || {}));
    let filteredPages = pagesByType.filter(
      (p) =>
        p.project_ids?.includes(projectId) &&
        (getPageName(p.name).toLowerCase().includes(this.filters.searchQuery.toLowerCase()) ||
          (p.tags ?? []).some((tag) => tag.toLowerCase().includes(this.filters.searchQuery.toLowerCase()))) &&
        shouldFilterPage(p, this.filters.filters)
    );
    filteredPages = orderPages(filteredPages, this.filters.sortKey, this.filters.sortBy);

    const pages = (filteredPages.map((page) => page.id) as string[]) || undefined;

    return pages ?? undefined;
  });

  /**
   * @description get the page store by id
   * @param {string} pageId
   */
  getPageById = computedFn((pageId: string) => this.data?.[pageId] || undefined);

  updateFilters = <T extends keyof TPageFilters>(filterKey: T, filterValue: TPageFilters[T]) => {
    runInAction(() => {
      set(this.filters, [filterKey], filterValue);
    });
  };

  /**
   * @description clear all the filters
   */
  clearAllFilters = () =>
    runInAction(() => {
      set(this.filters, ["filters"], {});
    });

  /**
   * @description fetch all the pages
   */
  fetchPagesList = async (workspaceSlug: string, projectId: string, pageType?: TPageNavigationTabs) => {
    try {
      if (!workspaceSlug || !projectId) return undefined;

      const currentPageIds = pageType ? this.getCurrentProjectPageIdsByTab(pageType) : undefined;
      runInAction(() => {
        this.loader = currentPageIds && currentPageIds.length > 0 ? `mutation-loader` : `init-loader`;
        this.error = undefined;
      });

      const pages = await this.service.fetchAll(workspaceSlug, projectId);
      runInAction(() => {
        for (const page of pages) {
          if (page?.id) {
            const existingPage = this.getPageById(page.id);
            if (existingPage) {
              // If page already exists, update all fields except name

              const { name, ...otherFields } = page;
              existingPage.mutateProperties(otherFields, false);
            } else {
              // If new page, create a new instance with all data
              set(this.data, [page.id], new ProjectPage(this.store, page));
            }
          }
        }
        this.loader = undefined;
      });

      return pages;
    } catch (error) {
      runInAction(() => {
        this.loader = undefined;
        this.error = {
          title: "Failed",
          description: "Failed to fetch the pages, Please try again later.",
        };
      });
      throw error;
    }
  };

  /**
   * @description fetch the details of a page
   * @param {string} pageId
   */
  fetchPageDetails = async (...args: Parameters<IProjectPageStore["fetchPageDetails"]>) => {
    const [workspaceSlug, projectId, pageId, options] = args;
    const { trackVisit } = options || {};
    try {
      if (!workspaceSlug || !projectId || !pageId) return undefined;

      const currentPageId = this.getPageById(pageId);
      runInAction(() => {
        this.loader = currentPageId ? `mutation-loader` : `init-loader`;
        this.error = undefined;
      });

      const page = await this.service.fetchById(workspaceSlug, projectId, pageId, trackVisit ?? true);

      runInAction(() => {
        if (page?.id) {
          const pageInstance = this.getPageById(page.id);
          if (pageInstance) {
            pageInstance.mutateProperties(page, false);
          } else {
            set(this.data, [page.id], new ProjectPage(this.store, page));
          }
        }
        this.loader = undefined;
      });

      return page;
    } catch (error) {
      runInAction(() => {
        this.loader = undefined;
        this.error = {
          title: "Failed",
          description: "Failed to fetch the page, Please try again later.",
        };
      });
      throw error;
    }
  };

  /**
   * @description create a page
   * @param {Partial<TPage>} pageData
   */
  createPage = async (pageData: Partial<TPage>) => {
    try {
      const { workspaceSlug, projectId } = this.store.router;
      if (!workspaceSlug || !projectId) return undefined;

      runInAction(() => {
        this.loader = "mutation-loader";
        this.error = undefined;
      });

      const page = await this.service.create(workspaceSlug, projectId, pageData);
      runInAction(() => {
        if (page?.id) set(this.data, [page.id], new ProjectPage(this.store, page));
        this.loader = undefined;
      });

      return page;
    } catch (error) {
      runInAction(() => {
        this.loader = undefined;
        this.error = {
          title: "Failed",
          description: "Failed to create a page, Please try again later.",
        };
      });
      throw error;
    }
  };

  /**
   * @description delete a page
   * @param {string} pageId
   */
  removePage = async ({ pageId, shouldSync: _shouldSync = true }: { pageId: string; shouldSync?: boolean }) => {
    try {
      const { workspaceSlug, projectId } = this.store.router;
      if (!workspaceSlug || !projectId || !pageId) return undefined;

      await this.service.remove(workspaceSlug, projectId, pageId);
      runInAction(() => {
        unset(this.data, [pageId]);
        if (this.rootStore.favorite.entityMap[pageId]) this.rootStore.favorite.removeFavoriteFromStore(pageId);
      });
    } catch (error) {
      runInAction(() => {
        this.loader = undefined;
        this.error = {
          title: "Failed",
          description: "Failed to delete a page, Please try again later.",
        };
      });
      throw error;
    }
  };

  /**
   * @description move a page to a new project
   * @param {string} workspaceSlug
   * @param {string} projectId
   * @param {string} pageId
   * @param {string} newProjectId
   */
  movePage = async (workspaceSlug: string, projectId: string, pageId: string, newProjectId: string) => {
    try {
      await this.service.move(workspaceSlug, projectId, pageId, newProjectId);
      runInAction(() => {
        unset(this.data, [pageId]);
      });
    } catch (error) {
      console.error("Unable to move page", error);
      throw error;
    }
  };

  /**
   * @description get all folders of a project
   * @param {string} projectId
   */
  getProjectFolders = computedFn((projectId: string) =>
    Object.values(this.folders).filter((folder) => folder.project === projectId)
  );

  /**
   * @description get the folders directly inside a folder, or at the project root when parentId is null
   */
  getChildFolders = computedFn((projectId: string, parentId: string | null) =>
    this.getProjectFolders(projectId)
      .filter((folder) => (folder.parent ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  /**
   * @description get the folder chain from the root down to the given folder
   */
  getFolderPath = computedFn((folderId: string | null) => {
    const path: TPageFolder[] = [];
    const visited = new Set<string>();
    let current = folderId ? this.folders[folderId] : undefined;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parent ? this.folders[current.parent] : undefined;
    }
    return path;
  });

  setLayout = (layout: TPageListLayout) => {
    this.layout = layout;
    try {
      localStorage.setItem(PAGE_LIST_LAYOUT_KEY, layout);
    } catch {
      // storage unavailable; keep the in-memory choice
    }
  };

  /**
   * @description fetch all folders of a project
   */
  fetchFolders = async (workspaceSlug: string, projectId: string) => {
    if (!workspaceSlug || !projectId) return undefined;
    const folders = await this.folderService.fetchAll(workspaceSlug, projectId);
    runInAction(() => {
      this.getProjectFolders(projectId).forEach((folder) => unset(this.folders, [folder.id]));
      folders.forEach((folder) => set(this.folders, [folder.id], folder));
    });
    return folders;
  };

  /**
   * @description create a folder in the current project
   */
  createFolder = async (data: Partial<TPageFolder>) => {
    const { workspaceSlug, projectId } = this.store.router;
    if (!workspaceSlug || !projectId) return undefined;
    const folder = await this.folderService.create(workspaceSlug, projectId, data);
    runInAction(() => set(this.folders, [folder.id], folder));
    return folder;
  };

  /**
   * @description rename or move a folder
   */
  updateFolder = async (folderId: string, data: Partial<TPageFolder>) => {
    const { workspaceSlug, projectId } = this.store.router;
    const existing = this.folders[folderId];
    if (!workspaceSlug || !projectId || !existing) return undefined;
    runInAction(() => set(this.folders, [folderId], { ...existing, ...data }));
    try {
      const folder = await this.folderService.update(workspaceSlug, projectId, folderId, data);
      runInAction(() => set(this.folders, [folderId], folder));
      return folder;
    } catch (error) {
      runInAction(() => set(this.folders, [folderId], existing));
      throw error;
    }
  };

  /**
   * @description delete a folder, its sub folders and the pages inside them
   */
  deleteFolder = async (folderId: string) => {
    const { workspaceSlug, projectId } = this.store.router;
    if (!workspaceSlug || !projectId) return;
    await this.folderService.remove(workspaceSlug, projectId, folderId);
    // the server removed the whole subtree; refetch to drop deleted pages and pick up re-homed ones
    await Promise.all([this.fetchFolders(workspaceSlug, projectId), this.syncPagesQuietly(workspaceSlug, projectId)]);
  };

  /**
   * @description move a page into a folder, or to the project root when folderId is null
   */
  movePageToFolder = async (pageId: string, folderId: string | null) => {
    const { workspaceSlug, projectId } = this.store.router;
    const page = this.getPageById(pageId);
    if (!workspaceSlug || !projectId || !page?.id) return;
    const previousFolder = page.folder;
    if (previousFolder === folderId) return;
    page.mutateProperties({ folder: folderId });
    try {
      await this.service.update(workspaceSlug, projectId, page.id, { folder: folderId });
    } catch (error) {
      page.mutateProperties({ folder: previousFolder });
      throw error;
    }
  };

  /**
   * @description every tag used in the project, de-duplicated case-insensitively and sorted
   */
  getProjectTags = computedFn((projectId: string) => {
    const tags = new Map<string, string>();
    this.getCurrentProjectPageIds(projectId).forEach((pageId) =>
      (this.getPageById(pageId)?.tags ?? []).forEach((tag) => {
        if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
      })
    );
    return sortBy([...tags.values()], (tag) => tag.toLowerCase());
  });

  /**
   * @description replace a page's tags; the server normalises them, so the response wins
   */
  updatePageTags = async (pageId: string, tags: string[]) => {
    const { workspaceSlug, projectId } = this.store.router;
    const page = this.getPageById(pageId);
    if (!workspaceSlug || !projectId || !page?.id) return;
    const previousTags = page.tags;
    page.mutateProperties({ tags });
    try {
      const response = await this.service.update(workspaceSlug, projectId, page.id, { tags });
      page.mutateProperties({ tags: response?.tags ?? tags });
    } catch (error) {
      page.mutateProperties({ tags: previousTags });
      throw error;
    }
  };

  /**
   * @description rename a tag on every page of the current project (merging into an existing tag)
   * @returns number of pages changed
   */
  renameProjectTag = async (name: string, newName: string) => {
    const { workspaceSlug, projectId } = this.store.router;
    if (!workspaceSlug || !projectId) return 0;
    const { pages_updated } = await this.service.renameTag(workspaceSlug, projectId, name, newName);
    await this.syncPagesQuietly(workspaceSlug, projectId);
    this.renameTagInFilters(name, newName);
    return pages_updated;
  };

  /**
   * @description remove a tag from every page of the current project
   * @returns number of pages changed
   */
  deleteProjectTag = async (name: string) => {
    const { workspaceSlug, projectId } = this.store.router;
    if (!workspaceSlug || !projectId) return 0;
    const { pages_updated } = await this.service.deleteTag(workspaceSlug, projectId, name);
    await this.syncPagesQuietly(workspaceSlug, projectId);
    this.renameTagInFilters(name, null);
    return pages_updated;
  };

  // keep an active tag filter pointing at the tag's new name, or drop it once the tag is gone
  private renameTagInFilters = (name: string, newName: string | null) => {
    const current = this.filters.filters?.tags;
    if (!current?.some((tag) => tag.toLowerCase() === name.toLowerCase())) return;
    const next = current.filter((tag) => tag.toLowerCase() !== name.toLowerCase());
    if (newName && !next.some((tag) => tag.toLowerCase() === newName.toLowerCase())) next.push(newName);
    this.updateFilters("filters", { ...this.filters.filters, tags: next });
  };

  // refetch pages without touching the loader, so the list (and any open dialog) stays mounted
  private syncPagesQuietly = async (workspaceSlug: string, projectId: string) => {
    const pages = await this.service.fetchAll(workspaceSlug, projectId);
    const pageIds = new Set(pages.map((page) => page.id));
    runInAction(() => {
      this.getCurrentProjectPageIds(projectId)
        .filter((pageId) => !pageIds.has(pageId))
        .forEach((pageId) => {
          unset(this.data, [pageId]);
          if (this.rootStore.favorite.entityMap[pageId]) this.rootStore.favorite.removeFavoriteFromStore(pageId);
        });
      pages.forEach((page) => {
        if (page.id)
          this.getPageById(page.id)?.mutateProperties({ folder: page.folder ?? null, tags: page.tags ?? [] }, false);
      });
    });
  };
}
