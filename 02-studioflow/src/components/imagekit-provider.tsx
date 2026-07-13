"use client";
import { ImageKitProvider as IKProvider } from "imagekitio-next";

export function ImageKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <IKProvider
      publicKey={process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!}
      urlEndpoint={process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!}
      authenticator={async () => {
        const res = await fetch("/api/imagekit/auth");
        return res.json();
      }}
    >
      {children}
    </IKProvider>
  );
}