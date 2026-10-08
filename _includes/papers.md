# Publications

[Full list on NASA ADS][ads] · [List of publications (PDF)](files/list_of_publications.pdf)
{% for group in site.data.papers %}
## {{ group.section }}
{% for p in group.papers %}
- **{{ p.date }}** — {% if p.url %}[{{ p.title }}]({{ p.url }}){% else %}{{ p.title }}{% endif %}  
  {{ p.authors | join: ", " }}; *{{ p.venue }}*
{%- endfor %}
{% endfor -%}

[ads]: {{ site.ads_url }}
