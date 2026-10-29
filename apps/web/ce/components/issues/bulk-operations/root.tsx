/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { EIssuesStoreType } from "@plane/types";
// components
import { IssueBulkOperationsToolbar } from "@/components/issues/bulk-operations/toolbar";
// hooks
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";

// archived and draft items are not served by the bulk endpoint
const UNSUPPORTED_STORES = new Set([EIssuesStoreType.ARCHIVED, EIssuesStoreType.WORKSPACE_DRAFT]);

type Props = {
  className?: string;
  /** float over the page instead of sitting under the layout (needed where sticky cells overlap it) */
  floating?: boolean;
  selectionHelpers: TSelectionHelper;
};

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { className, floating, selectionHelpers } = props;
  // store hooks
  const { isSelectionActive, selectedEntityIds } = useMultipleSelectStore();
  const storeType = useIssueStoreType();

  if (!isSelectionActive || selectionHelpers.isSelectionDisabled || UNSUPPORTED_STORES.has(storeType)) return null;

  return (
    <IssueBulkOperationsToolbar
      className={className}
      floating={floating}
      selectedIssueIds={selectedEntityIds}
      selectionHelpers={selectionHelpers}
    />
  );
});
