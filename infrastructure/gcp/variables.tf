variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "datapy-spider"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-east1"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token (passed via TF_VAR_ or secret)"
  type        = string
  sensitive   = true
  default     = ""
}
