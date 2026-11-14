import React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from "react-email";

import {
  emailLayout,
  generateDarkModeCSS,
  getTailwindConfig,
} from "../../config/styles";
import { EmailFooter } from "./email-footer";

interface EmailLayoutProps {
  children: React.ReactNode;
  previewText?: string;
  websiteUrl: string;
}

export function EmailLayout({
  children,
  previewText,
  websiteUrl,
}: EmailLayoutProps) {
  return (
    <Html dir="ltr" lang="en-GB">
      <Tailwind config={getTailwindConfig()}>
        <Head>
          <meta content="light dark" name="color-scheme" />
          <meta content="light dark" name="supported-color-schemes" />
          <style>{generateDarkModeCSS()}</style>
        </Head>
        {previewText && <Preview>{previewText}</Preview>}
        <Body className="font-sans" style={emailLayout.body}>
          <Container
            className="email-container mx-auto max-w-3xl px-8"
            style={emailLayout.container}
          >
            <Section>{children}</Section>
            <Section>
              <EmailFooter websiteUrl={websiteUrl} />
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
