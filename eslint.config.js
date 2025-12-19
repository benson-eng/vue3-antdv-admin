import antfu from '@antfu/eslint-config'

export default antfu(
  {
    lessOpinionated: true,
    formatters: true,
    vue: true,
    typescript: true,
    unocss: true,
    ignores: [],
  },
  {
    // Without `files`, they are general rules for all files
    rules: {
      'no-console': 'off',
      // 'style/multiline-comment-style': ['error', 'starred-block'],
      'jsdoc/convert-to-jsdoc-comments': ['warn'],
      'n/prefer-global/process': 'off',
      'vue/first-attribute-linebreak': 'off',
      'ts/no-unused-expressions': 'off',
      'style/semi': ['error', 'always'], // 語句結尾要分號
      // antfu/eslint-config v4：TypeScript 規則已移到 style namespace
      'style/member-delimiter-style': ['error', { multiline: { delimiter: 'semi' } }], // interface 成員要分號
      'unused-imports/no-unused-vars': [
        'error',
        {
          caughtErrors: 'none',
          varsIgnorePattern: '^_', // 忽略以 _ 开头的变量
          argsIgnorePattern: '^_', // 忽略以 _ 开头的参数
        },
      ],
    },
  },
).override('antfu/regexp/rules', () => ({}))
