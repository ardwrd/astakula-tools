import { Container } from "@cloudflare/containers";

/** Native PDF engine is reachable via Worker binding only. */
export class PdfProcessor extends Container {
  defaultPort = 8080;
  sleepAfter = "5m";
  enableInternet = false;
  pingEndpoint = "/health";
}
