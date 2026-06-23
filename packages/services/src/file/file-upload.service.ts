/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { isCancel } from "axios";
// api service
import { APIService } from "../api.service";
// helpers
import type { TFileUploadRequest } from "./helper";

/**
 * Service class for handling file upload operations
 * Handles file uploads
 * @extends {APIService}
 */
export class FileUploadService extends APIService {
  private abortController: AbortController | undefined;

  constructor() {
    super("");
  }

  /**
   * Uploads a file to the specified presigned PUT URL
   * @param {string} url - The presigned URL to upload the file to
   * @param {TFileUploadRequest} data - The raw file and the signed headers to replay
   * @returns {Promise<void>} Promise resolving to void
   * @throws {Error} If the request fails
   */
  async uploadFile(url: string, data: TFileUploadRequest): Promise<void> {
    this.abortController = new AbortController();
    return this.put(url, data.file, {
      headers: {
        ...data.headers,
      },
      signal: this.abortController.signal,
      withCredentials: false,
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

  /**
   * Cancels the upload
   */
  cancelUpload() {
    this.abortController?.abort();
  }
}
