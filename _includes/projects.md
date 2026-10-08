# Projects

## [Cavity Detection Tool (CADET)](https://github.com/tomasplsek/CADET)

CADET is a Python pipeline using machine learning to detect and size X-ray cavities in massive early-type galaxies and clusters observed with Chandra. It is released as the Python package [pycadet](https://pypi.org/project/pycadet/); the training and real-data application are described in [Plšek et al. 2024](https://academic.oup.com/mnras/article/527/2/3315/7339785). The pipeline provides an end-to-end workflow (data preparation, training/validation, and inference) and produces reproducible cavity catalogs with clear provenance.

[![Schematic of the CADET pipeline](files/architecture.webp){: width="2000" height="550" loading="lazy"}](https://github.com/tomasplsek/CADET)
*Schematic of the CADET pipeline.*
{: .figure .figure-wide}

## [Interactive beta modelling](https://github.com/tomasplsek/Beta-modelling)

A Jupyter-based tool for fitting 2D surface-brightness distributions of galaxies with single or composite [beta models](https://ui.adsabs.harvard.edu/abs/1976A%26A....49..137C/abstract) and inspecting residuals. It lets you interactively adjust model parameters, visualize residual structure in real time, and export best-fit values. Combines [Sherpa](https://cxc.cfa.harvard.edu/sherpa/) for modeling with [ipywidgets](https://github.com/jupyter-widgets/ipywidgets) for interactivity.

[![Interface of the Interactive beta modelling tool](files/beta.webp){: width="1344" height="1023" loading="lazy"}](https://github.com/tomasplsek/Beta-modelling)
*Interface of the Interactive beta modelling tool.*
{: .figure}
