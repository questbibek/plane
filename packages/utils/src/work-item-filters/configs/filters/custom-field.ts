/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TFilterProperty, TSupportedOperators } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/** A single selectable option for a custom field filter. */
export type TCustomFieldFilterOption = {
  id: string;
  name: string;
};

/**
 * Custom field filter specific params.
 */
export type TCreateCustomFieldFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<string> & {
    fieldName: string;
    options: TCustomFieldFilterOption[];
  };

/**
 * Helper to get the custom field multi select config.
 */
export const getCustomFieldMultiSelectConfig = (
  params: TCreateCustomFieldFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<TCustomFieldFilterOption, string, string>(
    {
      items: params.options,
      getId: (option) => option.id,
      getLabel: (option) => option.name,
      getValue: (option) => option.id,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      getOptionIcon: params.getOptionIcon,
    }
  );

/**
 * Get the custom field filter config. Used for option-like custom fields
 * (select, multi_select, member, label) and checkbox (two boolean options).
 * @param key - The filter key, e.g. `custom_field_<uuid>`.
 * @returns A function that takes parameters and returns the custom field filter config.
 */
export const getCustomFieldFilterConfig =
  <P extends TFilterProperty>(key: P): TCreateFilterConfig<P, TCreateCustomFieldFilterParams> =>
  (params: TCreateCustomFieldFilterParams) =>
    createFilterConfig<P>({
      id: key,
      label: params.fieldName,
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getCustomFieldMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
