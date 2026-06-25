/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Upload } from "lucide-react";
// plane imports
import { Breadcrumbs } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";

export const JiraImportProjectSettingsHeader = observer(function JiraImportProjectSettingsHeader() {
  return (
    <SettingsPageHeader
      leftItem={
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={<BreadcrumbLink label="Import from Jira" icon={<Upload className="size-4 text-tertiary" />} />}
            />
          </Breadcrumbs>
        </div>
      }
    />
  );
});
