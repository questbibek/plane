/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { AnchorButton } from "@makeplane/propel/components/anchor-button";
import { Button } from "@makeplane/propel/components/button";
import { EmptyStateDetailed } from "@plane/blocks/empty-state";
import { setToast } from "@plane/blocks/toast";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// constants
import { WORKSPACE_INVITATION } from "@plane/constants";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceService } from "@/services/workspace.service";
// services

// service initialization
const workspaceService = new WorkspaceService();

// sign-in page that comes back to this invite afterwards
const signInHref = () => {
  const here = `${window.location.pathname}${window.location.search}`;
  return `/?next_path=${encodeURIComponent(here)}`;
};

function WorkspaceInvitationPage() {
  // router
  const router = useAppRouter();
  // query params
  const searchParams = useSearchParams();
  const invitation_id = searchParams.get("invitation_id");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  // store hooks
  const { data: currentUser, signOut } = useUser();

  const { data: invitationDetail, error } = useSWR(
    invitation_id && slug && WORKSPACE_INVITATION(invitation_id.toString()),
    invitation_id && slug
      ? () => workspaceService.getWorkspaceInvitation(slug.toString(), invitation_id.toString())
      : null
  );

  // the server only lets the invited person accept (a security check), so tell anyone else what to do
  // instead of showing an Accept button that fails silently
  const invitedEmail = invitationDetail?.email ?? "";
  const isWrongAccount = !!currentUser && currentUser.email.toLowerCase() !== invitedEmail.toLowerCase();

  const showJoinError = (err: unknown) => {
    const message = (err as { error?: string } | undefined)?.error;
    setToast({ type: "error", title: "Error!", message: message ?? "Something went wrong. Please try again." });
  };

  const handleSwitchAccount = async () => {
    try {
      await signOut();
    } finally {
      // a full load so the sign-in page starts without the previous account's state
      window.location.href = signInHref();
    }
  };

  const handleAccept = async () => {
    if (!invitationDetail) return;
    try {
      await workspaceService.joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: true,
        token: token,
      });
      router.push(invitationDetail.email === currentUser?.email ? `/${invitationDetail.workspace.slug}` : "/");
    } catch (err) {
      showJoinError(err);
    }
  };

  const handleReject = async () => {
    if (!invitationDetail || !token) return;
    try {
      await workspaceService.joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: false,
        token: token,
      });
      router.push("/");
    } catch (err) {
      showJoinError(err);
    }
  };

  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        {invitationDetail && !invitationDetail.responded_at ? (
          error ? (
            <EmptyStateDetailed
              align="center"
              assetKey="invalid-link"
              assetClassName="size-40"
              title="INVITATION NOT FOUND"
            />
          ) : (
            <EmptyStateDetailed
              align="center"
              assetKey="inbox"
              title={`You have been invited to ${invitationDetail.workspace.name}`}
              description={
                !currentUser
                  ? `This invitation was sent to ${invitedEmail}. Sign in with that email to accept it.`
                  : isWrongAccount
                    ? `This invitation was sent to ${invitedEmail}, but you are signed in as ${currentUser.email}. Sign in as ${invitedEmail} to accept it.`
                    : "Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
              }
              actions={
                !currentUser
                  ? [{ label: "Sign in to accept", variant: "primary", onClick: () => router.push(signInHref()) }]
                  : isWrongAccount
                    ? [{ label: "Switch account", variant: "primary", onClick: () => void handleSwitchAccount() }]
                    : [
                        { label: "Accept", variant: "primary", onClick: () => void handleAccept() },
                        { label: "Ignore", variant: "secondary", onClick: () => void handleReject() },
                      ]
              }
            />
          )
        ) : error || invitationDetail?.responded_at ? (
          invitationDetail?.accepted ? (
            <EmptyStateDetailed
              align="center"
              assetKey="project"
              title={`You are already a member of ${invitationDetail.workspace.name}`}
              description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
              customButton={
                <Button
                  variant="primary"
                  size="lg"
                  stretch="auto"
                  label="Continue to home"
                  nativeButton={false}
                  render={<Link href="/" />}
                />
              }
            />
          ) : (
            <EmptyStateDetailed
              align="center"
              assetKey="invalid-link"
              title="This invitation link is not active anymore."
              description="Your workspace is where you'll create projects, collaborate on your work items, and organize different streams of work in your Plane account."
              customButton={
                <div className="flex flex-col items-center gap-4">
                  <Button
                    variant="primary"
                    size="lg"
                    stretch="auto"
                    label={!currentUser ? "Sign in to continue" : "Continue to home"}
                    nativeButton={false}
                    render={<Link href="/" />}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    {/* VRIT BRANDING — upstream's "Star us on GitHub" button removed */}
                    <AnchorButton
                      variant="secondary"
                      size="md"
                      href="https://forum.plane.so"
                      external
                      label="Join our community of active creators"
                    />
                    <AnchorButton
                      variant="secondary"
                      size="md"
                      render={<Link href="/" />}
                      label="Or start from an empty project"
                    />
                  </div>
                </div>
              }
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <LogoSpinner />
          </div>
        )}
      </div>
    </AuthenticationWrapper>
  );
}

export default observer(WorkspaceInvitationPage);
