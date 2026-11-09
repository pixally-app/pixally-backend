import matplotlib.pyplot as plt
import numpy as np

campos = ['id_transacao', 'nome_pagador', 'valor', 'data_hora', 'banco', 'Todos\ncorretos']

variantes = ['A - OCR puro', 'B - img + OCR', 'C - texto OCR', 'D - só imagem']
cores = ['#555555', '#1976D2', '#F57C00', '#388E3C']

dados = [
    [21.7,  0.0,  80.0,  26.7,  0.0,  0.0],   # A
    [45.0, 100.0, 100.0, 100.0, 80.0, 43.3],   # B
    [23.3,  73.3,  90.0,  86.7, 86.7, 18.3],   # C
    [36.7, 100.0, 100.0,  96.7, 78.3, 35.0],   # D
]

todos_corretos = [0.0,  43.3, 18.3, 35.0]
ic_inf         = [0.0,  31.6, 10.6, 24.2]
ic_sup         = [6.0,  55.9, 29.9, 47.6]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6), facecolor='white')
fig.suptitle('Avaliação da extração de comprovantes PIX - Experimento pareado (n = 60)',
             fontsize=13, fontweight='bold', color='black', y=1.01)

# Gráfico 1: acerto por campo
x = np.arange(len(campos))
width = 0.19

for i, (label, valores, cor) in enumerate(zip(variantes, dados, cores)):
    offset = (i - 1.5) * width
    ax1.bar(x + offset, valores, width, label=label, color=cor, alpha=0.88, edgecolor='white')

ax1.set_facecolor('white')
ax1.set_title('Acerto por campo (execução 1)', fontsize=12, fontweight='bold', color='black', pad=10)
ax1.set_ylabel('Taxa de acerto (%)', fontsize=10, color='black')
ax1.set_xticks(x)
ax1.set_xticklabels(campos, fontsize=9, color='black')
ax1.set_ylim(0, 118)
ax1.legend(fontsize=8.5, framealpha=0.95, loc='upper left')
ax1.tick_params(colors='black')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.grid(axis='y', alpha=0.2, color='gray')
ax1.axhline(100, color='gray', linestyle='--', linewidth=0.6, alpha=0.35)

# Gráfico 2: totalmente corretos + IC 95%
rotulos = ['A\n(OCR puro)', 'B\n(img+OCR)', 'C\n(texto OCR)', 'D\n(só imagem)']
x2 = np.arange(len(rotulos))

yerr_low  = [t - i for t, i in zip(todos_corretos, ic_inf)]
yerr_high = [s - t for t, s in zip(todos_corretos, ic_sup)]

barras = ax2.bar(x2, todos_corretos, color=cores, alpha=0.88, edgecolor='white', width=0.5)
ax2.errorbar(x2, todos_corretos,
             yerr=[yerr_low, yerr_high],
             fmt='none', color='black', capsize=8, linewidth=1.8, zorder=5)

for barra, val, inf, sup in zip(barras, todos_corretos, ic_inf, ic_sup):
    ax2.text(barra.get_x() + barra.get_width() / 2,
             sup + 2.5,
             f'{val:.1f}%\n[{inf:.1f}–{sup:.1f}]',
             ha='center', va='bottom', fontsize=8.5, color='black', linespacing=1.4)

ax2.set_facecolor('white')
ax2.set_title('Comprovantes totalmente corretos\ncom IC 95% de Wilson (execução 1)',
              fontsize=12, fontweight='bold', color='black', pad=10)
ax2.set_ylabel('Taxa (%)', fontsize=10, color='black')
ax2.set_xticks(x2)
ax2.set_xticklabels(rotulos, fontsize=9, color='black')
ax2.set_ylim(0, 78)
ax2.tick_params(colors='black')
ax2.spines['top'].set_visible(False)
ax2.spines['right'].set_visible(False)
ax2.grid(axis='y', alpha=0.2, color='gray')

plt.tight_layout(pad=3)
plt.savefig('grafico_variantes.png', dpi=150, bbox_inches='tight', facecolor='white')
plt.show()
print("Salvo em grafico_variantes.png")
