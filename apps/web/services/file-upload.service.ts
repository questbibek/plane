/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AxiosRequestConfig } from "axios";
import { isCancel } from "axios";
// plane services
import type { TFileUploadRequest } from "@plane/services";
// services
import { APIService } from "@/services/api.service";

export class FileUploadService extends APIService {
  private abortController: AbortController | undefined;

  constructor() {
    super("");
  }

  async uploadFile(
    url: string,
    data: TFileUploadRequest,
    uploadProgressHandler?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<void> {
    this.abortController = new AbortController();
    return this.put(url, data.file, {
      headers: {
        ...data.headers,
      },
      signal: this.abortController.signal,
      withCredentials: false,
      onUploadProgress: uploadProgressHandler,
    })
      .then((response) => response?.data)
      .catch((error) => {
        if (isCancel(error)) {
          console.log(error.message);
        } else {
          throw error?.response?.data;
        }
      });
  }

  cancelUpload() {
    this.abortController?.abort();
  }
}
