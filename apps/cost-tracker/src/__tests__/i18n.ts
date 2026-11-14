import {
  createTranslator,
  type NamespaceKeys,
  type NestedKeyOf,
} from "next-intl";

import messages from "@/messages/en-GB";

export { messages };

export async function getTranslations<
  Namespace extends NamespaceKeys<typeof messages, NestedKeyOf<typeof messages>>,
>(namespace: Namespace) {
  return createTranslator({ locale: "en-GB", messages, namespace });
}
