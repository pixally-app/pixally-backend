import csv
import unicodedata
import re
import os
from collections import defaultdict

GABARITO_FILE = "gabarito.csv"
VARIANTS = ['A', 'B', 'C', 'D']
OUTPUT_FILE = "resultados_avaliacao_v2.csv"

BANCO_KEYWORDS = {
    'bradesco': 'bradesco',
    'itau': 'itau', 'itaú': 'itau',
    'nubank': 'nubank', 'nu pagamentos': 'nubank',
    'caixa': 'caixa',
    'santander': 'santander',
    'bb': 'bb', 'banco do brasil': 'bb',
    'sicoob': 'sicoob',
    'c6': 'c6',
}


def remove_accents(s):
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )


def norm_str(s):
    if not s:
        return ''
    return remove_accents(s.strip().lower())


def norm_id(s):
    return s.strip().upper() if s else ''


def norm_valor(s):
    if not s:
        return None
    s = s.strip().upper().replace('R$', '').replace(' ', '')
    has_comma = ',' in s
    has_dot = '.' in s
    try:
        if has_comma and has_dot:
            s = s.replace('.', '').replace(',', '.')
        elif has_comma:
            s = s.replace(',', '.')
        return round(float(s), 2)
    except ValueError:
        return None


def norm_data(s):
    if not s:
        return ''
    s = s.strip().replace('T', ' ')
    return s[:16]  # YYYY-MM-DD HH:MM


def round_time(s):
    if not s:
        return ''
    try:
        v = round(float(s), 3)
        return str(v).replace('.', ',')  # vírgula como decimal (padrão BR)
    except ValueError:
        return ''


def norm_banco(s):
    if not s:
        return ''
    s_lower = norm_str(s)
    for keyword, canonical in BANCO_KEYWORDS.items():
        if keyword in s_lower:
            return canonical
    return s_lower


def ok_id(extraido, gabarito):
    e = norm_id(extraido)
    g = norm_id(gabarito)
    if not g:
        return ''
    return 1 if e == g else 0


def ok_nome(extraido, gabarito):
    e = norm_str(extraido)
    g = norm_str(gabarito)
    if not g:
        return ''
    return 1 if e == g else 0


def ok_valor(extraido, gabarito):
    e = norm_valor(extraido)
    g = norm_valor(gabarito)
    if g is None:
        return ''
    if e is None:
        return 0
    return 1 if abs(e - g) < 0.01 else 0


def ok_data(extraido, gabarito):
    e = norm_data(extraido)
    g = norm_data(gabarito)
    if not g:
        return ''
    return 1 if e == g else 0


def ok_banco(extraido, gabarito):
    e = norm_banco(extraido)
    g = norm_banco(gabarito)
    if not g:
        return ''
    return 1 if e == g else 0


# Lê o gabarito
gabarito = {}
with open(GABARITO_FILE, encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    next(reader)  # pula "Aba Gabarito"
    next(reader)  # pula cabeçalho
    for row in reader:
        if not row or not row[0] or row[0].startswith('EX-'):
            continue
        gabarito[row[0]] = {
            'id_transacao': row[4] if len(row) > 4 else '',
            'nome_pagador': row[5] if len(row) > 5 else '',
            'valor_rs': row[6] if len(row) > 6 else '',
            'data_hora': row[7] if len(row) > 7 else '',
            'banco': row[8] if len(row) > 8 else '',
        }

print(f"Gabarito carregado: {len(gabarito)} comprovantes")

# Processa cada variante
output_rows = []

for variant in VARIANTS:
    filename = f"avaliacao_{variant}.csv"
    if not os.path.exists(filename):
        print(f"Arquivo não encontrado: {filename}")
        continue

    with open(filename, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cid = row['comprovante_id']
            gab = gabarito.get(cid)
            if not gab:
                print(f"  Sem gabarito para {cid}")
                continue

            oi = ok_id(row['id_transacao_extraido'], gab['id_transacao'])
            on = ok_nome(row['nome_pagador_extraido'], gab['nome_pagador'])
            ov = ok_valor(row['valor_extraido'], gab['valor_rs'])
            od = ok_data(row['data_hora_extraido'], gab['data_hora'])
            ob = ok_banco(row['banco_extraido'], gab['banco'])

            campos = [x for x in [oi, on, ov, od, ob] if x != '']
            todos = 1 if campos and all(x == 1 for x in campos) else 0

            output_rows.append({
                'comprovante_id': cid,
                'variante': row['variante'],
                'execucao': row['execucao'],
                'ok_id': oi,
                'ok_nome': on,
                'ok_valor': ov,
                'ok_data': od,
                'ok_banco': ob,
                'todos_corretos': todos,
                'tempo_ocr_s': round_time(row['tempo_ocr_s']),
                'tempo_api_s': round_time(row['tempo_api_s']),
                'tempo_total_s': round_time(row['tempo_total_s']),
                'tokens_entrada': row['tokens_entrada'],
                'tokens_saida': row['tokens_saida'],
            })

    count = sum(1 for r in output_rows if r['variante'] == variant)
    print(f"Variante {variant}: {count} linhas processadas")

# Escreve resultado
fieldnames = [
    'comprovante_id', 'variante', 'execucao',
    'ok_id', 'ok_nome', 'ok_valor', 'ok_data', 'ok_banco', 'todos_corretos',
    'tempo_ocr_s', 'tempo_api_s', 'tempo_total_s',
    'tokens_entrada', 'tokens_saida',
]

with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(output_rows)

print(f"\nResultado salvo em {OUTPUT_FILE} - {len(output_rows)} linhas")