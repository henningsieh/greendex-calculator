import {
  createTranslator,
  type NamespaceKeys,
  type NestedKeyOf,
} from "next-intl";

import messages from "@/messages/en";

export { messages };

export async function getTranslations<
  Namespace extends NamespaceKeys<typeof messages, NestedKeyOf<typeof messages>>,
>(namespace: Namespace) {
  return createTranslator({ locale: "en", messages, namespace });
}
