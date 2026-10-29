const visibleAttributes = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "cancelLabel",
  "caption",
  "confirmLabel",
  "description",
  "emptyMessage",
  "errorMessage",
  "heading",
  "helperText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "title",
  "tooltip",
]);

function hasVisibleCopy(value) {
  return /\p{L}/u.test(value.replace(/&[a-zA-Z][a-zA-Z0-9]+;/g, " "));
}

export default {
  meta: { name: "greendex" },
  rules: {
    "no-hardcoded-ui-copy": {
      meta: {
        type: "problem",
        messages: {
          hardcoded: 'Hardcoded UI copy "{{copy}}": use a translation instead.',
        },
      },
      create(context) {
        function report(node, value) {
          if (!hasVisibleCopy(value)) return;
          const copy = value.replace(/\s+/g, " ").trim();
          context.report({ node, messageId: "hardcoded", data: { copy } });
        }

        function reportVisibleExpression(node) {
          switch (node.type) {
            case "Literal":
              if (typeof node.value === "string") report(node, node.value);
              break;
            case "TemplateLiteral":
              for (const [index, quasi] of node.quasis.entries()) {
                report(quasi, quasi.value.cooked ?? quasi.value.raw);
                if (node.expressions[index]) {
                  reportVisibleExpression(node.expressions[index]);
                }
              }
              break;
            case "ConditionalExpression":
              reportVisibleExpression(node.consequent);
              reportVisibleExpression(node.alternate);
              break;
            case "ArrayExpression":
              for (const element of node.elements) {
                if (element) reportVisibleExpression(element);
              }
              break;
            case "LogicalExpression":
              if (node.operator !== "&&") reportVisibleExpression(node.left);
              reportVisibleExpression(node.right);
              break;
            case "BinaryExpression":
              if (node.operator === "+") {
                reportVisibleExpression(node.left);
                reportVisibleExpression(node.right);
              }
              break;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
            case "TSTypeAssertion":
              reportVisibleExpression(node.expression);
              break;
          }
        }

        return {
          JSXText(node) {
            report(node, node.value);
          },
          JSXExpressionContainer(node) {
            if (
              node.parent.type === "JSXElement" ||
              node.parent.type === "JSXFragment"
            ) {
              reportVisibleExpression(node.expression);
            }
          },
          JSXAttribute(node) {
            if (!visibleAttributes.has(node.name.name) || !node.value) return;
            if (node.value.type === "JSXExpressionContainer") {
              reportVisibleExpression(node.value.expression);
            } else {
              reportVisibleExpression(node.value);
            }
          },
        };
      },
    },
  },
};
