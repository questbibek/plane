/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { JiraImportRoot } from "@/components/jira-import/root";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { JiraImportProjectSettingsHeader } from "./header";

function JiraImportSettingsPage() {
  // store hooks
  const { currentProjectDetails } = useProject();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();

  const pageTitle = currentProjectDetails?.name ? `${currentProjectDetails?.name} - Import from Jira` : undefined;

  // derived values
  const canImport = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  if (workspaceUserInfo && !canImport) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<JiraImportProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <JiraImportRoot />
    </SettingsContentWrapper>
  );
}

export default observer(JiraImportSettingsPage);
