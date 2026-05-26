<?php
declare(strict_types=1);

/**
 * Public privacy helper.
 *
 * Used by unauthenticated API endpoints to ensure student/user name fields
 * never leak into responses. See Requirements 8.1 and 8.2 of the
 * student-school-credentials spec:
 *
 *   8.1 The System SHALL NOT render full_name, first_name, middle_name,
 *       last_name, or extension_name on any Public_Page response.
 *   8.2 The System SHALL NOT include any of those columns in the response
 *       payload of any unauthenticated API endpoint.
 *
 * The recommended pattern at the call site is to either:
 *   (a) replace `SELECT *` with an explicit allow-list of columns that
 *       excludes the name fields, OR
 *   (b) call stripPrivateNameFields() on the response payload immediately
 *       before echoing JSON, as a defense-in-depth pass.
 *
 * Both layers are cheap; (a) is preferred because it never reads the data
 * out of the database in the first place. (b) protects against future
 * regressions where a developer adds a new field to a query and forgets
 * the privacy implications.
 */

if (!function_exists('stripPrivateNameFields')) {
    /**
     * Recursively remove user name fields from any structure.
     *
     * Removes the following keys from any associative array encountered
     * anywhere in the structure (at any nesting depth):
     *
     *   - full_name
     *   - first_name
     *   - middle_name
     *   - last_name
     *   - extension_name
     *
     * Indexed arrays are walked element-by-element; their numeric keys are
     * preserved. Scalars and nulls pass through unchanged. The input is
     * returned as a new value; the caller's reference is not mutated.
     *
     * Note: this helper deliberately does NOT strip a generic `name` key,
     * because many non-user contexts (school year names, document type
     * names, file names) legitimately use that key. Call sites that store
     * a user name under a generic `name` key should rename the field or
     * strip it explicitly.
     *
     * @param mixed $data Any value (array, scalar, null).
     * @return mixed The same shape with name fields removed.
     */
    function stripPrivateNameFields($data)
    {
        if (!is_array($data)) {
            return $data;
        }

        static $blocked = [
            'full_name'      => true,
            'first_name'     => true,
            'middle_name'    => true,
            'last_name'      => true,
            'extension_name' => true,
        ];

        $out = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && isset($blocked[$key])) {
                continue;
            }
            $out[$key] = is_array($value) ? stripPrivateNameFields($value) : $value;
        }
        return $out;
    }
}
