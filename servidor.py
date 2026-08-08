#!/usr/bin/env python3
"""
SAGE-TI — Servidor HTTP para a intranet.

Publica a pasta do SAGE-TI na rede local. Requer apenas a biblioteca padrão
do Python (testado em 3.13).

    python servidor.py

Depois, de qualquer máquina da rede:  http://10.50.21.93:8080
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import os
import socket
import socketserver
import sys
from datetime import datetime
from pathlib import Path

# ==========================================================================
#  CONFIGURAÇÃO — é aqui que se define host e porta
# ==========================================================================

#  '0.0.0.0' = escuta em todas as interfaces de rede (acessível pela intranet).
#  '127.0.0.1' seria o modo restrito, visível só nesta máquina.
HOST = "0.0.0.0"

#  Porta fixa do sistema.
PORT = 8080

#  Raiz servida: a pasta onde este arquivo está — nunca o diretório de onde
#  o comando foi chamado. Assim o servidor funciona a partir de qualquer lugar.
DIRETORIO = Path(__file__).resolve().parent

# ==========================================================================


class SageTiHandler(http.server.SimpleHTTPRequestHandler):
    """Servidor de arquivos estáticos ajustado para o SAGE-TI."""

    # MIME types explícitos: alguns Windows têm o registro corrompido e
    # devolvem 'text/plain' para .js, o que faz o navegador recusar o script.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        "": "application/octet-stream",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRETORIO), **kwargs)

    def end_headers(self) -> None:
        # Sem cache: ao editar um .js ou .css, basta recarregar a página nas
        # outras máquinas — não é preciso limpar o cache de cada navegador.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        # Cabeçalhos de segurança básicos para uso em rede interna.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        super().end_headers()

    def log_message(self, formato: str, *args) -> None:
        """Log de uma linha por requisição, com quem acessou."""
        hora = datetime.now().strftime("%H:%M:%S")
        origem = self.client_address[0]
        print(f"  {hora}  {origem:<15}  {formato % args}", flush=True)

    def log_error(self, formato: str, *args) -> None:
        # Conexões abandonadas pelo navegador são ruído, não erro.
        if "Broken pipe" in (formato % args) or "Connection reset" in (formato % args):
            return
        self.log_message(formato, *args)


class ServidorSageTi(socketserver.ThreadingTCPServer):
    """
    ThreadingTCPServer: cada requisição em sua própria thread, para várias
    máquinas navegarem ao mesmo tempo sem uma travar a outra.
    """

    daemon_threads = True
    allow_reuse_address = True  # permite reiniciar sem esperar o TIME_WAIT


def ips_da_maquina() -> list[str]:
    """IPv4 desta máquina, exceto loopback e link-local."""
    encontrados: set[str] = set()

    # Descobre o IP da interface usada para sair na rede (não abre conexão).
    with contextlib.suppress(OSError):
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            encontrados.add(s.getsockname()[0])

    with contextlib.suppress(OSError):
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            encontrados.add(info[4][0])

    return sorted(
        ip for ip in encontrados
        if not ip.startswith("127.") and not ip.startswith("169.254.")
    )


def verificar_pasta() -> None:
    """Aborta cedo se o servidor foi posto na pasta errada."""
    if not (DIRETORIO / "index.html").is_file():
        print(f"\n  ERRO: não encontrei 'index.html' em {DIRETORIO}")
        print("  Coloque servidor.py dentro da pasta CELAB (ao lado do index.html).\n")
        raise SystemExit(1)


def banner(host: str, porta: int) -> None:
    ips = ips_da_maquina()
    largura = 68

    print()
    print("  " + "=" * largura)
    print("   SAGE-TI — Sistema de Ativos e Gestão de Estoque de Tecnologia da Informação")
    print("   servidor da intranet ativo")
    print("  " + "=" * largura)
    print(f"   Pasta servida : {DIRETORIO}")
    print(f"   Escutando em  : {host}:{porta}", end="")
    print("   (todas as interfaces)" if host == "0.0.0.0" else "")
    print()
    print("   Acesse pelo navegador:")
    print(f"     nesta máquina        http://localhost:{porta}")
    for ip in ips:
        print(f"     na rede              http://{ip}:{porta}")
    if not ips:
        print("     (nenhuma interface de rede detectada)")
    print()
    print("   Se outra máquina não abrir, libere a porta no firewall — uma vez,")
    print("   em um PowerShell como Administrador:")
    print()
    print('     New-NetFirewallRule -DisplayName "SAGE-TI 8080" -Direction Inbound `')
    print(f"       -Protocol TCP -LocalPort {porta} -Action Allow -Profile Private")
    print()
    print("   Ctrl+C encerra o servidor.")
    print("  " + "-" * largura)
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Servidor HTTP do SAGE-TI para a rede local.")
    parser.add_argument("--host", default=HOST,
                        help=f"endereço de escuta (padrão: {HOST})")
    parser.add_argument("--porta", type=int, default=PORT,
                        help=f"porta TCP (padrão: {PORT})")
    args = parser.parse_args()

    verificar_pasta()

    try:
        servidor = ServidorSageTi((args.host, args.porta), SageTiHandler)
    except OSError as erro:
        print(f"\n  ERRO ao abrir {args.host}:{args.porta} — {erro}\n")
        if getattr(erro, "errno", None) in (48, 98, 10048):
            print("  A porta já está em uso. Descubra quem a ocupa com:")
            print(f"    Get-NetTCPConnection -LocalPort {args.porta} | "
                  "Select-Object OwningProcess")
            print("    Get-Process -Id <OwningProcess>\n")
        elif getattr(erro, "errno", None) in (13, 10013):
            print("  Permissão negada. Portas abaixo de 1024 exigem privilégio "
                  "de administrador.\n")
        return 1

    banner(args.host, args.porta)

    with servidor:
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            print("\n\n  Encerrando o servidor…")
            servidor.shutdown()
            print("  Servidor parado.\n")

    return 0


if __name__ == "__main__":
    # Saída sem buffer: os logs aparecem na hora, mesmo redirecionados.
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    sys.exit(main())
