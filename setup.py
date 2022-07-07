"""
Setup Module to setup Python Handlers for the nbgallery extension.
"""
import os
from os.path import join as pjoin
import distutils.cmd

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, ensure_python, get_version
)
import setuptools


class CleanCommand(distutils.cmd.Command):
    description = "Cleans out build and intermediate files"
    user_options = []

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        cmd_list = dict(
            labextensions="find . -name labextension -type d -print0 | xargs -0 rm -rf",
            build="rm -rf build;",
            dist="rm -rf dist;",
            yarn="rm -rf node_modules && rm yarn.lock",
            egginfo="rm -rf *.egg-info;"
        )
        for key, cmd in cmd_list.items():
            os.system(cmd)


HERE = os.path.abspath(os.path.dirname(__file__))

# The name of the project
name = "jupyterlab_nbgallery"

# Ensure a valid python version
ensure_python(">=3.5")

# Get the version
version = get_version(pjoin(name, "_version.py"))

lab_path = pjoin(HERE, "labextension")

# Representative files that should exist after a successful build
jstargets = [
    pjoin(HERE, "environment-life", "lib", "index.js"),
    pjoin(HERE, "environment-registration", "lib", "index.js"),
    pjoin(HERE, "autodownload", "lib", "index.js"),
    pjoin(HERE, "gallerymenu", "lib", "index.js"),
    pjoin(HERE, "instrumentation", "lib", "index.js"),
    pjoin(HERE, "inject-uuid", "lib", "index.js"),
]

package_data_spec = {
    name: [
        "*"
    ]
}

data_files_spec = [
    ("share/jupyter/labextensions/@jupyterlab-nbgallery", lab_path, "autodownload/**"),
    ("share/jupyter/labextensions/@jupyterlab-nbgallery",
     lab_path, "environment-life/**"),
    ("share/jupyter/labextensions/@jupyterlab-nbgallery",
     lab_path, "environment-registration/**"),
    ("share/jupyter/labextensions/@jupyterlab-nbgallery", lab_path, "gallerymenu/**"),
    ("share/jupyter/labextensions/@jupyterlab-nbgallery", lab_path, "inject-uuid/**"),
    ("share/jupyter/labextensions/@jupyterlab-nbgallery",
     lab_path, "instrumentation/**"),
    ("etc/jupyter/jupyter_notebook_config.d",
     "jupyter-config", "jupyterlab_nbgallery.json"),
]

cmdclass = create_cmdclass("jsdeps",
                           package_data_spec=package_data_spec,
                           data_files_spec=data_files_spec
                           )

cmdclass["jsdeps"] = combine_commands(
    install_npm(HERE, build_cmd="build-ext", npm=["jlpm"]),
    ensure_targets(jstargets),
)
cmdclass["clean"] = CleanCommand

with open("README.md", "r") as fh:
    long_description = fh.read()

setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/nbgallery/lab-extensions",
    author="NBGallery",
    description="A JupyterLab Extension for NBGallery integration",
    long_description=long_description,
    long_description_content_type="text/markdown",
    cmdclass=cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        "jupyterlab>=3.1.0",
        "jupyter-nbgallery~=2.0",
    ],
    zip_safe=False,
    include_package_data=True,
    license="MIT",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab"],
    classifiers=[
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.5",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Framework :: Jupyter",
    ],
)


if __name__ == '__main__':
    setuptools.setup(**setup_args)
